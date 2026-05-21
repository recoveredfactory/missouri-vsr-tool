<script lang="ts">
  import { home_287g_chip, home_287g_chip_aria } from "$lib/paraglide/messages";

  export let value:
    | string
    | { value?: string; href?: string; program287g?: boolean }
    | null
    | undefined = "";
  export let href: string | null | undefined = undefined;

  let label = "—";
  let resolvedHref = "";
  let program287g = false;

  $: {
    if (value && typeof value === "object") {
      label = value.value ? String(value.value) : "—";
      resolvedHref = href ? String(href) : value.href ? String(value.href) : "";
      program287g = Boolean(value.program287g);
    } else {
      label = value === null || value === undefined || value === "" ? "—" : String(value);
      resolvedHref = href ? String(href) : "";
      program287g = false;
    }
  }
</script>

{#if resolvedHref}
  <a
    class="block whitespace-normal text-[0.72rem] font-semibold leading-snug text-emerald-900 no-underline transition-colors hover:text-emerald-700 hover:no-underline sm:text-sm"
    href={resolvedHref}
  >
    {label}
    {#if program287g}
      <span
        class="ml-1 inline-block whitespace-nowrap rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 align-middle text-[0.6rem] font-semibold uppercase tracking-wide text-slate-700"
        aria-label={home_287g_chip_aria()}
      >{home_287g_chip()}</span>
    {/if}
  </a>
{:else}
  <span class="block whitespace-normal text-[0.72rem] font-semibold leading-snug text-slate-700 sm:text-sm">
    {label}
    {#if program287g}
      <span
        class="ml-1 inline-block whitespace-nowrap rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 align-middle text-[0.6rem] font-semibold uppercase tracking-wide text-slate-700"
        aria-label={home_287g_chip_aria()}
      >{home_287g_chip()}</span>
    {/if}
  </span>
{/if}
