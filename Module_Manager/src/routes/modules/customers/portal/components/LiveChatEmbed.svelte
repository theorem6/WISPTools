<script lang="ts">
  import { onMount } from 'svelte';

  export let embedHtml: string = '';

  onMount(() => {
    if (!embedHtml || typeof document === 'undefined') return;
    const wrap = document.createElement('div');
    wrap.innerHTML = embedHtml;
    const scripts = wrap.querySelectorAll('script');
    scripts.forEach((oldScript) => {
      const script = document.createElement('script');
      if (oldScript.src) {
        script.src = oldScript.src;
      } else {
        script.textContent = oldScript.textContent || '';
      }
      oldScript.getAttributeNames().forEach((name) => {
        if (name !== 'src') script.setAttribute(name, oldScript.getAttribute(name) || '');
      });
      document.body.appendChild(script);
    });
  });
</script>
