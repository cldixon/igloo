<script lang="ts">
  /** Steps of a flow: 1 files › 2 details › 3 review. Done steps are links back. */
  type Step = { label: string; href?: string | null; state: "done" | "current" | "todo" };
  let { steps, label = "Progress" }: { steps: Step[]; label?: string } = $props();
</script>

<nav aria-label={label} class="data">
  <ol class="flex flex-wrap gap-x-2 gap-y-1">
    {#each steps as step, i (i)}
      <li class="flex gap-2">
        {#if i > 0}<span aria-hidden="true" class="text-muted">›</span>{/if}
        {#if step.state === "current"}
          <span aria-current="step" class="font-semibold">{i + 1} {step.label}</span>
        {:else if step.href}
          <a href={step.href}>{i + 1} {step.label}</a>
        {:else}
          <span class="text-muted">{i + 1} {step.label}</span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
