<script>
  import "../app.css";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import { navigating, page } from "$app/stores";

  export let data;

  const fallbackUmamiWebsiteId = import.meta.env.PUBLIC_UMAMI_WEBSITE_ID ?? null;
  const siteName = "Missouri Vehicle Stops";
  const normalizePath = (pathname) => {
    const normalized = String(pathname || "/").replace(/\/+$/, "");
    return normalized || "/";
  };

  $: umamiWebsiteId = data?.umamiWebsiteId ?? fallbackUmamiWebsiteId;
  $: fromPath = normalizePath($navigating?.from?.url?.pathname);
  $: toPath = normalizePath($navigating?.to?.url?.pathname);
  $: isNavigating = Boolean($navigating) && fromPath !== toPath;
  $: isEmbed = Boolean($page.data.isEmbed);
</script>

<svelte:head>
  <meta name="application-name" content={siteName} />
  <meta name="apple-mobile-web-app-title" content={siteName} />
  {#if umamiWebsiteId}
    <script
      defer
      src="https://cloud.umami.is/script.js"
      data-website-id={umamiWebsiteId}
    ></script>
  {/if}
</svelte:head>

{#if isEmbed}
  <slot />
{:else}
  <a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:ring-2 focus:ring-[#25784c]"
  >
    Skip to main content
  </a>
  <div class={`page-fade ${isNavigating ? "page-fade--loading" : ""}`}>
    <slot />
  </div>
  <SiteFooter />
{/if}
