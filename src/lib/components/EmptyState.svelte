<script lang="ts">
  interface Props {
    active?: boolean
    agentName?: string
  }

  let { active = false, agentName = '' }: Props = $props()
</script>

<div class:active class="empty-state">
  <h2 class="empty-title">Hello, I'm {agentName}</h2>
</div>

<style>
  .empty-state {
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
    padding: 3rem 1.5rem;
  }

  .empty-state.active {
    display: flex;
  }

  .empty-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.015em;
  }
</style>
