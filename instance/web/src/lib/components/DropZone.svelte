<script lang="ts">
  import { droppedFiles, pickedFiles, type PickedFile } from "$lib/files";

  /** Drop files or a folder, or browse for them. */
  let {
    onfiles,
    disabled = false,
    hint,
  }: { onfiles: (files: PickedFile[]) => void; disabled?: boolean; hint?: string } = $props();

  let over = $state(false);
  let fileInput: HTMLInputElement;
  let folderInput: HTMLInputElement;

  async function drop(event: DragEvent) {
    event.preventDefault();
    over = false;
    if (disabled || !event.dataTransfer) return;
    onfiles(await droppedFiles(event.dataTransfer));
  }

  function pick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (input.files) onfiles(pickedFiles(input.files));
    input.value = "";
  }
</script>

<div
  role="group"
  aria-label="Add files"
  class="grid justify-items-center gap-1 border border-dashed border-line px-4 py-8 text-center {over
    ? 'bg-sunken'
    : ''} {disabled ? 'opacity-50' : ''}"
  ondragover={(e) => {
    e.preventDefault();
    over = !disabled;
  }}
  ondragleave={() => (over = false)}
  ondrop={drop}
>
  <p>
    Drop files or a folder here, or
    <button type="button" class="underline" {disabled} onclick={() => fileInput.click()}
      >browse files</button
    >
    ·
    <button type="button" class="underline" {disabled} onclick={() => folderInput.click()}
      >a folder</button
    >
  </p>
  {#if hint}<p class="text-meta text-muted">{hint}</p>{/if}
  <input bind:this={fileInput} type="file" multiple hidden onchange={pick} />
  <input bind:this={folderInput} type="file" webkitdirectory hidden onchange={pick} />
</div>
