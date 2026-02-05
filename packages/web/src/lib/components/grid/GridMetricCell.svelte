<script lang="ts">
  export let value: string | number | null | undefined = "";
  export let metricKey: string = "";
  export let onOpen: ((key: string) => void) | undefined;
  export let isGroupByHeader = false;

  let displayValue = "—";
  $: displayValue =
    value === null || value === undefined || value === "" ? "—" : String(value);

  const handleClick = () => {
    if (!isGroupByHeader && onOpen && metricKey) {
      onOpen(metricKey);
    }
  };
</script>

<button
  type="button"
  class="block w-full text-left text-xs font-semibold text-emerald-900 underline decoration-emerald-900 decoration-1 underline-offset-2 whitespace-normal break-words leading-tight transition-colors hover:text-emerald-600 hover:decoration-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 sm:text-sm"
  aria-label={metricKey ? `View details for ${metricKey}` : undefined}
  on:click={handleClick}
>
  {displayValue}
</button>
