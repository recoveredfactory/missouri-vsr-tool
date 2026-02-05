<script>
  import "../app.css";
  import SiteFooter from "$lib/components/SiteFooter.svelte";

  export let data;

  const fallbackUmamiWebsiteId = import.meta.env.PUBLIC_UMAMI_WEBSITE_ID ?? null;
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

<a
  href="#main-content"
  class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:ring-2 focus:ring-[#0f766e]"
>
  Skip to main content
</a>
<slot />
<SiteFooter />
