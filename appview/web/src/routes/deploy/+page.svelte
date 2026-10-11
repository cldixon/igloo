<script lang="ts">
  import { CopyButton, Section } from "@igloo/ui";
</script>

<svelte:head><title>Deploy your own igloo</title></svelte:head>

<div class="grid max-w-reading gap-8">
  <div class="grid gap-2">
    <h1 class="text-page font-semibold">Deploy your own igloo</h1>
    <p>
      An igloo is your own small server for sharing datasets. It runs in your Cloudflare account, on
      your domain, with your files in your own R2 bucket. Publishing a data dir announces it here;
      the files never leave your igloo.
    </p>
  </div>

  <Section title="You need">
    <ul class="grid list-disc gap-1 pl-5">
      <li><a href="https://bun.sh">Bun</a> and a Cloudflare account (the free plan works).</li>
      <li>An AT Protocol account, such as a Bluesky one. It becomes the owner.</li>
      <li>Optionally, a domain on Cloudflare, like <code class="data">data.example.com</code>.</li>
    </ul>
  </Section>

  <Section title="Steps">
    <ol class="grid list-decimal gap-4 pl-5">
      <li class="grid gap-1">
        <span
          >Create your deploy folder. This signs you in to Cloudflare, asks for a name, a bucket, a
          title and an optional domain, then deploys and prints a one-time setup code.</span
        >
        <span class="flex flex-wrap items-center gap-3"
          ><code class="data bg-sunken px-2 py-1">bun create igloo my-igloo</code>
          <CopyButton value="bun create igloo my-igloo" /></span
        >
      </li>
      <li>
        Open <code class="data">/admin</code> on your igloo, sign in with your handle and the setup code.
        That claims it.
      </li>
      <li>Make a data dir, add files, publish. It shows up on the feed within seconds.</li>
    </ol>
  </Section>

  <p class="text-meta text-muted">
    The deploy folder holds only your settings. Updates come from the released
    <code class="data">@igloo-data/instance</code> package. Source and docs:
    <a href="https://github.com/cldixon/igloo">github.com/cldixon/igloo</a>.
  </p>
</div>
