<script lang="ts">
  import changelogMarkdown from '../../../../CHANGELOG.md?raw';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { parseChangelog } from '$lib/domain/changelog';
  import { t } from '$lib/i18n/index.svelte';

  let { close }: { close: () => void } = $props();
  const releases = parseChangelog(changelogMarkdown);
  const currentVersion = __ATLORE_BUILD__.match(/^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\./)?.[1];

  function displayDate(value: string) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.valueOf())) return value;
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(date);
  }
</script>

<Modal title={t('changelog.title')} eyebrow={t('changelog.eyebrow')} {close} wide>
  <div class="release-list">
    {#each releases as release}
      <article class:current={release.version === currentVersion}>
        <header>
          <div>
            <h3>v{release.version}</h3>
            {#if release.date}<time datetime={release.date}>{displayDate(release.date)}</time>{/if}
          </div>
          {#if release.version === currentVersion}<span>{t('changelog.current')}</span>{/if}
        </header>
        <div class="groups">
          {#each release.groups.filter((group) => group.items.length) as group}
            <section>
              <h4>{group.title}</h4>
              <ul>
                {#each group.items as item}<li>{item}</li>{/each}
              </ul>
            </section>
          {/each}
        </div>
      </article>
    {/each}
    <a
      class="source"
      href="https://github.com/jellesiderius/atlore/blob/main/CHANGELOG.md"
      target="_blank"
      rel="noreferrer">{t('changelog.source')}</a
    >
  </div>
</Modal>

<style>
  .release-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  article {
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 13px;
    background: color-mix(in srgb, var(--bg-2) 68%, var(--canvas));
  }
  article.current {
    border-color: color-mix(in srgb, var(--ember) 36%, var(--line));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ember) 7%, transparent);
  }
  article > header {
    min-height: 63px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    padding: 12px 15px;
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--bg-3) 38%, transparent);
  }
  article > header > div {
    min-width: 0;
  }
  h3 {
    margin: 0;
    color: var(--text);
    font: 20px var(--font-serif);
    font-weight: 400;
  }
  time {
    display: block;
    margin-top: 3px;
    color: var(--text-3);
    font: 9px var(--font-mono);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  header > span {
    padding: 4px 7px;
    border: 1px solid color-mix(in srgb, var(--ember) 30%, var(--line));
    border-radius: 999px;
    background: var(--ember-soft);
    color: var(--ember);
    font: 8px var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .groups {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px 24px;
    padding: 16px;
  }
  .groups section:only-child {
    grid-column: 1 / -1;
  }
  h4 {
    margin: 0 0 8px;
    color: var(--ember);
    font: 9px var(--font-mono);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin: 0;
    padding: 0;
    color: var(--text-2);
    font-size: 12.5px;
    line-height: 1.55;
    list-style: none;
  }
  li {
    position: relative;
    padding-left: 13px;
  }
  li::before {
    position: absolute;
    left: 0;
    top: 0.65em;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--ember);
    content: '';
  }
  .source {
    align-self: center;
    margin: 2px 0 3px;
    color: var(--text-3);
    font: 9px var(--font-mono);
    letter-spacing: 0.05em;
  }
  .source:hover {
    color: var(--ember);
  }
  @media (max-width: 600px) {
    .groups {
      grid-template-columns: 1fr;
    }
  }
</style>
