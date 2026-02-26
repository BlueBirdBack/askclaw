<script lang="ts">
  import { onMount } from 'svelte';
  import { chatState } from './lib/state.svelte';
  import { t } from './lib/i18n';
  import { fetchUsername, streamChat } from './lib/api';
  import Header from './components/Header.svelte';
  import MessageList from './components/MessageList.svelte';
  import ChatInput from './components/ChatInput.svelte';

  let chatInput: ChatInput;

  onMount(() => {
    chatState.setLang(chatState.lang);
    fetchUsername().then((u) => (chatState.username = u));
    chatInput.focus();
  });

  async function handleSend(text: string) {
    if (chatState.streaming) return;

    chatState.addUserMessage(text);
    chatState.addAssistantPlaceholder();
    chatState.streaming = true;

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

<style>
  #shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    max-width: 760px;
    margin: 0 auto;
  }
</style>
