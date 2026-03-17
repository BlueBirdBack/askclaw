<script lang="ts">
  import type { ConnectionStatus } from '../stores/chat'

  interface Props {
    status?: ConnectionStatus
  }

  let { status = 'ready' }: Props = $props()
</script>

<span class={`status-dot ${status}`} aria-hidden="true"></span>

<style>
  .status-dot {
    width: 0.42rem;
    height: 0.42rem;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--text-dim);
  }

  .ready {
    background: #22c55e;
  }

  .streaming {
    background: #f59e0b;
    animation: pulse 1.1s ease-in-out infinite;
  }

  .error {
    background: #ef4444;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>
