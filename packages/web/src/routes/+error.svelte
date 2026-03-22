<script>
  import { page } from "$app/stores";
  import { getLocale } from "$lib/paraglide/runtime";
  import StickyHeader from "$lib/components/StickyHeader.svelte";

  export let data;

  $: status = $page.status;
  $: message = status === 404 ? "Page not found" : ($page.error?.message || "Something went wrong");
  $: locale = getLocale() ?? "en";
</script>

<svelte:head>
  <title>{status} {message} — Missouri Vehicle Stops</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<StickyHeader agencies={data?.agencies ?? []} />

<main id="main-content" class="flex min-h-[60vh] items-center justify-center bg-white px-6">
  <div class="text-center">
    <p class="text-7xl font-bold text-[#25784c]">{status}</p>
    <h1 class="mt-4 text-2xl font-bold text-slate-900">{message}</h1>
    <p class="mt-2 text-slate-600">
      {#if status === 404}
        The page you're looking for doesn't exist or may have moved.
      {:else}
        An unexpected error occurred.
      {/if}
    </p>
    <a
      href="/{locale}"
      class="mt-6 inline-block rounded-lg bg-[#25784c] px-6 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#1b613c]"
    >
      Back to homepage
    </a>
  </div>
</main>
