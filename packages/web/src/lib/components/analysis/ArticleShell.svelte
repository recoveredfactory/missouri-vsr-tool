<script>
  // Visual frame for an analysis article. Lives as a *component* (not raw HTML
  // in the .md) so that mdsvex parses the markdown placed in its slot — markdown
  // nested directly in plain HTML block elements is passed through literally.
</script>

<main id="main-content" class="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
  <article class="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-3xl sm:prose-h1:text-4xl prose-h2:mt-12 prose-a:text-[#1b613c]">
    <slot />
  </article>
</main>
