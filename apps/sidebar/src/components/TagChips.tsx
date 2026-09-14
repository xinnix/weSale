import type { TagItem } from '../api/profile';

const SOURCE_LABEL: Record<string, string> = {
  CHANNEL: '渠道',
  LIVECODE: '活码',
  BEHAVIOR: '行为',
};

/** 语义标签 chips：行为标签（实时推导）+ 渠道/活码标签（落库） */
export default function TagChips({ tags }: { tags: TagItem[] }) {
  if (!tags.length) {
    return <div className="tags empty">暂无标签</div>;
  }
  return (
    <div className="tags">
      {tags.map((t) => (
        <span
          key={`${t.source}-${t.name}`}
          className={`tag tag-${t.source.toLowerCase()}`}
          title={`来源：${SOURCE_LABEL[t.source] ?? t.source}`}
        >
          {t.name}
        </span>
      ))}
    </div>
  );
}
