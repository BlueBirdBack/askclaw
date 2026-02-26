<script lang="ts">
  import { chatState } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
</script>

<div class="welcome">
  <div>
    <h2>{t(chatState.lang, 'welcomeTitle')}</h2>
    <p>{t(chatState.lang, 'welcomeDesc')}</p>
  </div>
</div>

<style>
  .welcome {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 20px;
  }
  h2 {
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  p {
    color: var(--text2);
    font-size: 14px;
  }
</style>
