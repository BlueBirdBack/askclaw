<div class="typing">
  <span></span>
  <span></span>
  <span></span>
</div>

<style>
  .typing {
    display: inline-flex;
    gap: 4px;
    padding: 4px 0;
  }
  .typing span {
    width: 6px;
    height: 6px;
    background: var(--text3);
    border-radius: 50%;
    animation: bounce 0.6s infinite alternate;
  }
  .typing span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .typing span:nth-child(3) {
    animation-delay: 0.4s;
  }
</style>
