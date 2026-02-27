<script lang="ts">
  import { onMount } from 'svelte';
  import { chatState } from './lib/state.svelte';
  import { t } from './lib/i18n';
  import { fetchUsername, streamChat, createChat, saveMessages, uploadFiles, readFileAsBase64 } from './lib/api';
  import type { ChatMessage, PendingFile, Attachment, ContentBlock } from './lib/types';
  import Header from './components/Header.svelte';
  import WarningBanner from './components/WarningBanner.svelte';
  import TosModal from './components/TosModal.svelte';
  import PasswordModal from './components/PasswordModal.svelte';
  import MessageList from './components/MessageList.svelte';
  import ChatInput from './components/ChatInput.svelte';

  let tosOpen = $state(false);
  let passwordOpen = $state(false);
  let chatInput: ChatInput;

  onMount(() => {
    chatState.setLang(chatState.lang);
    fetchUsername().then((u) => (chatState.username = u));
    chatInput.focus();
  });

  async function handleSend(text: string, files: PendingFile[]) {
    if (chatState.streaming) return;

    // Wait for any in-progress compressions to finish
    await Promise.all(files.map(f => f.ready));

    // Extract raw File objects from proxy wrappers immediately
    const rawFiles: File[] = files.map(pf => pf.file);

    // Read base64 data from raw files BEFORE any state changes (avoids $state proxy issues)
    let imageData: { data: string; media_type: string }[] = [];
    if (rawFiles.length > 0) {
      try {
        imageData = await Promise.all(rawFiles.map(f => readFileAsBase64(f)));
      } catch {
        // base64 read failed, will send text-only
      }
    }

    // Revoke preview URLs early
    for (const pf of files) {
      URL.revokeObjectURL(pf.previewUrl);
    }

    // On first message, create a new chat in the backend
    const isFirstMessage = !chatState.currentChatId;
    if (isFirstMessage) {
      const chatId = crypto.randomUUID();
      chatState.currentChatId = chatId;
      createChat(chatId, chatState.model).catch(() => {});
    }

    // Upload files to backend and get server attachments
    let attachments: Attachment[] = [];
    if (rawFiles.length > 0) {
      try {
        attachments = await uploadFiles(rawFiles);
      } catch {
        chatState.addError(t(chatState.lang, 'uploadFailed'));
        return;
      }
    }

    chatState.addUserMessage(text, attachments.length > 0 ? attachments : undefined);
    chatState.addAssistantPlaceholder();
    chatState.streaming = true;

    const userText = text;

    // Build LLM messages: copy history but replace the last user message with multimodal content
    const llmMessages: ChatMessage[] = chatState.history.map(m => ({ role: m.role, content: m.content }));
    if (imageData.length > 0) {
      const blocks: ContentBlock[] = [
        { type: 'input_text', text: text || 'What is in the image(s)?' },
        ...imageData.map(img => ({
          type: 'input_image' as const,
          source: { type: 'base64' as const, media_type: img.media_type, data: img.data },
        })),
      ];
      llmMessages[llmMessages.length - 1] = { role: 'user', content: blocks };
    }

    await streamChat(
      llmMessages,
      chatState.model,
      chatState.username,
      {
        onChunk(accumulated) {
          chatState.updateLastAssistant(accumulated);
        },
        onDone(full) {
          if (!full) {
            chatState.updateLastAssistant(`*${t(chatState.lang, 'noResponse')}*`);
          }
          chatState.finalizeAssistant(full);
          chatState.streaming = false;
          chatInput.focus();

          // Save user + assistant messages to backend
          if (chatState.currentChatId && full) {
            saveMessages(chatState.currentChatId, [
              { role: 'user', content: userText, attachment_ids: attachments.map(a => a.id) },
              { role: 'assistant', content: full },
            ]).catch(() => {});
          }
        },
        onError(code) {
          chatState.removeLastAssistant();
          chatState.rollbackLastUser();
          let msg: string;
          if (code === 'network') {
            msg = t(chatState.lang, 'errNetwork');
          } else if (code === '502') {
            msg = t(chatState.lang, 'errRestart');
          } else if (code === '429') {
            msg = t(chatState.lang, 'errRate');
          } else {
            msg = t(chatState.lang, 'errGeneric').replace('{code}', code);
          }
          chatState.addError(msg);
          chatState.streaming = false;
          chatInput.focus();
        },
      },
    );
  }
</script>

<div id="shell">
  <Header onopenpassword={() => passwordOpen = true} />
  <MessageList />
  <ChatInput bind:this={chatInput} onsend={handleSend} />
</div>

<WarningBanner onopentos={() => tosOpen = true} />
<TosModal open={tosOpen} onclose={() => tosOpen = false} />
<PasswordModal open={passwordOpen} onclose={() => passwordOpen = false} />

<style>
  #shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    max-width: 760px;
    margin: 0 auto;
  }
</style>
