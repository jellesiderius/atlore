export interface ChangelogGroup {
  title: string;
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  date: string;
  groups: ChangelogGroup[];
}

function readableText(value: string) {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();
}

export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let release: ChangelogRelease | null = null;
  let group: ChangelogGroup | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const releaseHeading = line.match(/^## \[([^\]]+)](?:\s+-\s+(.+))?$/);
    if (releaseHeading) {
      const version = releaseHeading[1];
      release =
        version.toLowerCase() === 'unreleased'
          ? null
          : { version, date: releaseHeading[2] ?? '', groups: [] };
      group = null;
      if (release) releases.push(release);
      continue;
    }

    if (!release) continue;
    const groupHeading = line.match(/^###\s+(.+)$/);
    if (groupHeading) {
      group = { title: readableText(groupHeading[1]), items: [] };
      release.groups.push(group);
      continue;
    }

    const item = line.match(/^\s*-\s+(.+)$/);
    if (item && group) group.items.push(readableText(item[1]));
  }

  return releases.filter((item) => item.groups.some((section) => section.items.length));
}
