<script lang="ts">
  export let value: string | { value?: string; href?: string } | null | undefined = "";
  export let href: string | null | undefined = undefined;

  let label = "—";
  let resolvedHref = "";

  $: {
    if (value && typeof value === "object") {
      label = value.value ? String(value.value) : "—";
      resolvedHref = href ? String(href) : value.href ? String(value.href) : "";
    } else {
      label = value === null || value === undefined || value === "" ? "—" : String(value);
      resolvedHref = href ? String(href) : "";
    }
  }
</script>

{#if resolvedHref}
  <a
    class="block whitespace-normal text-[0.72rem] font-semibold leading-snug text-emerald-900 no-underline transition-colors hover:text-emerald-700 hover:no-underline sm:text-sm"
    href={resolvedHref}
  >
    {label}
  </a>
{:else}
  <span class="block whitespace-normal text-[0.72rem] font-semibold leading-snug text-slate-700 sm:text-sm">
    {label}
  </span>
{/if}
