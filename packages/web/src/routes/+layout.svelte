<script>
  import "../app.css";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import { setDataBaseUrl } from "$lib/dataBase";

  export let data;

  const fallbackUmamiWebsiteId = import.meta.env.PUBLIC_UMAMI_WEBSITE_ID ?? null;
  $: umamiWebsiteId = data?.umamiWebsiteId ?? fallbackUmamiWebsiteId;
  $: dataBaseUrl = data?.dataBaseUrl ?? "";
  $: if (dataBaseUrl) {
    setDataBaseUrl(dataBaseUrl);
  }
</script>

<svelte:head>
  {#if umamiWebsiteId}
    <script
      defer
      src="https://cloud.umami.is/script.js"
      data-website-id={umamiWebsiteId}
    ></script>
  {/if}
  {#if dataBaseUrl}
    <script>
      window.__DATA_BASE_URL__ = {JSON.stringify(dataBaseUrl)};
    </script>
  {/if}
</svelte:head>

<a
  href="#main-content"
  class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:ring-2 focus:ring-[#25784c]"
>
  Skip to main content
</a>
<slot />
<SiteFooter />
