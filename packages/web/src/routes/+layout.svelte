<script>
  import "../app.css";

  export let data;
</script>

<svelte:head>
  {#if data?.umamiWebsiteId}
    <script
      defer
      src="https://cloud.umami.is/script.js"
      data-website-id={data.umamiWebsiteId}
    ></script>
  {/if}
</svelte:head>

<slot />
