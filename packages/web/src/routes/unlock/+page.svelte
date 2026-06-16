<script>
  import { enhance } from "$app/forms";

  export let data;
  export let form;
</script>

<svelte:head>
  <title>Staging preview — Missouri Vehicle Stops</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main
  class="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12"
>
  <div
    class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
  >
    <p
      class="text-xs font-semibold uppercase tracking-wider text-[#17643b]"
    >
      Staging preview
    </p>
    <h1 class="mt-2 text-xl font-semibold text-slate-900">
      Missouri Vehicle Stops
    </h1>
    <p class="mt-2 text-sm text-slate-600">
      This is a private preview build. Enter the password to continue.
    </p>

    <form method="POST" use:enhance class="mt-6 space-y-4">
      <input type="hidden" name="next" value={data.next} />
      <div>
        <label
          for="password"
          class="block text-sm font-medium text-slate-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
          autofocus
          class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-[#17643b] focus:outline-none focus:ring-2 focus:ring-[#17643b]/30"
        />
      </div>

      {#if form?.error}
        <p class="text-sm text-red-600" role="alert">
          Incorrect password. Try again.
        </p>
      {/if}

      <button
        type="submit"
        class="w-full rounded-lg bg-[#17643b] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1c5c3a] focus:outline-none focus:ring-2 focus:ring-[#17643b]/40"
      >
        Enter
      </button>
    </form>
  </div>
</main>
