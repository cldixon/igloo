<script lang="ts">
  import { SignInForm } from "@igloo/ui";

  let { data } = $props();
</script>

<svelte:head><title>Sign in · igloo</title></svelte:head>

<div class="grid max-w-form gap-4">
  <h1 class="text-page font-semibold">Sign in</h1>
  <p>
    Use your AT Protocol account: Bluesky, or any PDS. igloo only asks who you are; it can't post or
    change anything in your account.
  </p>
  <SignInForm action="/login" handle={data.handle} error={data.error}>
    {#snippet note()}
      You'll be redirected to your PDS to authorize. No email, no password.
    {/snippet}
  </SignInForm>
</div>
