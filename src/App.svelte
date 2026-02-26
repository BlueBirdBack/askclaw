<script lang="ts">
  import { onMount } from 'svelte';
  import { chatState } from './lib/state.svelte';
  import { t } from './lib/i18n';
  import { fetchUsername, streamChat, createChat, saveMessages } from './lib/api';
  import Header from './components/Header.svelte';
  import WarningBanner from './components/WarningBanner.svelte';
  import TosModal from './components/TosModal.svelte';
  import MessageList from './components/MessageList.svelte';
  import ChatInput from './components/ChatInput.svelte';

  let tosOpen = $state(false);
  let chatInput: ChatInput;

  onMount(() => {
    chatState.setLang(chatState.lang);
    fetchUsername().then((u) => (chatState.username = u));
    chatInput.focus();
  });

  async function handleSend(text: string) {
    if (chatState.streaming) return;

    // On first message, create a new chat in the backend
    const isFirstMessage = !chatState.currentChatId;
    if (isFirstMessage) {
      const chatId = crypto.randomUUID();
      chatState.currentChatId = chatId;
      createChat(chatId, chatState.model).catch(() => {});
    }

    chatState.addUserMessage(text);
    chatState.addAssistantPlaceholder();
    chatState.streaming = true;

    const userText = text;

    await streamChat(
      [...chatState.history],
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
              { role: 'user', content: userText },
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
  <Header />
  <MessageList />
  <ChatInput bind:this={chatInput} onsend={handleSend} />
</div>

<WarningBanner onopentos={() => tosOpen = true} />
<TosModal open={tosOpen} onclose={() => tosOpen = false} />

<style>
  #shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    max-width: 760px;
    margin: 0 auto;
  }
</style>
