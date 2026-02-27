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

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  async function handleSend(text: string, files: PendingFile[]) {
    if (chatState.streaming || chatState.uploading) return;

    const hasFiles = files.length > 0;
    if (hasFiles) chatState.uploading = true;

    // Wait for any in-progress compressions to finish
    await Promise.all(files.map(f => f.ready));

    // Split into image vs non-image files
    const imageFiles = files.filter(pf => pf.isImage);
    const nonImageFiles = files.filter(pf => !pf.isImage);

    // Extract raw File objects from proxy wrappers immediately
    const rawImageFiles: File[] = imageFiles.map(pf => pf.file);
    const rawNonImageFiles: File[] = nonImageFiles.map(pf => pf.file);
    const allRawFiles: File[] = [...rawImageFiles, ...rawNonImageFiles];

    // Read base64 data from image files BEFORE any state changes (avoids $state proxy issues)
    let imageData: { data: string; media_type: string }[] = [];
    if (rawImageFiles.length > 0) {
      try {
        imageData = await Promise.all(rawImageFiles.map(f => readFileAsBase64(f)));
      } catch {
        // base64 read failed, will send text-only for images
      }
    }

    // Revoke preview URLs for images only
    for (const pf of imageFiles) {
      URL.revokeObjectURL(pf.previewUrl);
    }

    // On first message, create a new chat in the backend
    const isFirstMessage = !chatState.currentChatId;
    if (isFirstMessage) {
      const chatId = crypto.randomUUID();
      chatState.currentChatId = chatId;
      createChat(chatId, chatState.model).catch(() => {});
    }

    // Upload all files to backend and get server attachments
    let attachments: Attachment[] = [];
    if (allRawFiles.length > 0) {
      try {
        attachments = await uploadFiles(allRawFiles);
      } catch {
        chatState.uploading = false;
        chatState.addError(t(chatState.lang, 'uploadFailed'));
        return;
      }
    }

    chatState.uploading = false;

    chatState.addUserMessage(text, attachments.length > 0 ? attachments : undefined);
    chatState.addAssistantPlaceholder();
    chatState.streaming = true;

    const userText = text;

    // Build LLM messages: copy history but replace the last user message with multimodal content
    const llmMessages: ChatMessage[] = chatState.history.map(m => ({ role: m.role, content: m.content }));
    if (imageData.length > 0 || nonImageFiles.length > 0) {
      const blocks: ContentBlock[] = [];

      // Add text blocks for non-image file attachments (so the LLM knows what was attached)
      const nonImageAttachments = attachments.filter(a =>
        !a.content_type.startsWith('image/')
      );
      for (const att of nonImageAttachments) {
        blocks.push({
          type: 'input_text',
          text: `[Attached file: ${att.filename} (${att.content_type}, ${formatSize(att.size)}) at ${att.storage_path}]`,
        });
      }

      // Add the user's text
      blocks.push({ type: 'input_text', text: text || (imageData.length > 0 ? 'What is in the image(s)?' : 'See the attached file(s).') });

      // Add base64 image blocks
      for (const img of imageData) {
        blocks.push({
          type: 'input_image',
          source: { type: 'base64', media_type: img.media_type, data: img.data },
        });
      }

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
  <Header onopenpassword={() => passwordOpen = true} onopentos={() => tosOpen = true} />
  <WarningBanner onopentos={() => tosOpen = true} />
  <MessageList />
  <ChatInput bind:this={chatInput} onsend={handleSend} />
</div>

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
