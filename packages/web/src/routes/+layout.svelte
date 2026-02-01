<script>
  import "../app.css";

  export let data;

  const fallbackUmamiWebsiteId = import.meta.env.UMAMI_WEBSITE_ID ?? null;
  $: umamiWebsiteId = data?.umamiWebsiteId ?? fallbackUmamiWebsiteId;
</script>

<svelte:head>
  {#if umamiWebsiteId}
    <script
      defer
      src="https://cloud.umami.is/script.js"
      data-website-id={umamiWebsiteId}
    ></script>
  {/if}
</svelte:head>

<slot />
