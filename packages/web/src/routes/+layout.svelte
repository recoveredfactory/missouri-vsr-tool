<script>
  import "../app.css";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import { navigating } from "$app/stores";

  export let data;

  const fallbackUmamiWebsiteId = import.meta.env.PUBLIC_UMAMI_WEBSITE_ID ?? null;
  const normalizePath = (pathname) => {
    const normalized = String(pathname || "/").replace(/\/+$/, "");
    return normalized || "/";
  };

  $: umamiWebsiteId = data?.umamiWebsiteId ?? fallbackUmamiWebsiteId;
  $: fromPath = normalizePath($navigating?.from?.url?.pathname);
  $: toPath = normalizePath($navigating?.to?.url?.pathname);
  $: fromRouteId = $navigating?.from?.route?.id ?? null;
  $: toRouteId = $navigating?.to?.route?.id ?? null;
  $: shouldFadeForNavigation =
    Boolean($navigating) && (fromPath !== toPath || fromRouteId !== toRouteId);
  $: isNavigating = shouldFadeForNavigation;
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
  class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:ring-2 focus:ring-[#25784c]"
>
  Skip to main content
</a>
<div class={`page-fade ${isNavigating ? "page-fade--loading" : ""}`}>
  <slot />
</div>
<SiteFooter />
