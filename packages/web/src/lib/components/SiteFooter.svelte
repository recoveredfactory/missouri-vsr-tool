<script>
  import {
    home_header_title,
    home_donate_button,
    footer_project_of,
    footer_developed_by,
    footer_conjunction,
    footer_copyright,
    footer_data_disclaimer,
  } from "$lib/paraglide/messages";

  const donateUrl =
    import.meta.env.PUBLIC_DONATE_URL ??
    "https://buy.stripe.com/6oU9AU1KEa7Z6gcdr6fAc03";

  $: copyrightYear = new Date().getFullYear() === 2026 ? "2026" : `2026\u2013${new Date().getFullYear()}`;
</script>

<footer class="border-t-6 border-t-[#1b613c] bg-white">
  <div class="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12 md:w-[85%] md:px-0">
    <div class="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
      <div class="space-y-4 text-center md:text-left">
        <div>
          <a href="/" class="text-lg font-bold text-[#1b613c] no-underline hover:text-[#105430]">
            {home_header_title()}
          </a>
        </div>

        <div class="space-y-2 text-sm text-slate-600">
          <p>
            {footer_project_of()} <a
              href="https://recoveredfactory.net/en#signup"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-slate-700 underline decoration-slate-400 underline-offset-2 hover:text-[#105430] hover:decoration-[#105430]"
            >Recovered Factory</a>
          </p>
          <p>
            {footer_developed_by()}
            <a
              href="https://davideads.com/en"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-slate-700 underline decoration-slate-400 underline-offset-2 hover:text-[#105430] hover:decoration-[#105430]"
            >David Eads</a>
            {footer_conjunction()}
            <a
              href="https://www.tlysik.com/"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-slate-700 underline decoration-slate-400 underline-offset-2 hover:text-[#105430] hover:decoration-[#105430]"
            >Tory Lysik</a>
          </p>
        </div>
        <p class="text-xs text-slate-500">
          {footer_copyright({ year: copyrightYear })}
        </p>
        <p class="text-xs text-slate-500">
          {footer_data_disclaimer()}
        </p>
      </div>

      <div class="flex flex-col items-center gap-3 md:items-end">
        <a
          href={donateUrl}
          class="inline-flex items-center rounded-lg bg-[#1b613c] px-6 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#105430]"
        >
          {home_donate_button()}
        </a>
      </div>
    </div>
  </div>
</footer>
