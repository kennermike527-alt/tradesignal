import { ExternalLink, Heart, MessageCircle, Repeat2, Quote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { clampText, formatNumber, formatRelativeTime } from '@/lib/format';
import { CATEGORY_LABELS, type DashboardPost } from '@/components/dashboard/types';

interface PostCardProps {
  post: DashboardPost;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <Card className="border-slate-800 bg-slate-950/60">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold text-slate-100">{post.account.displayName}</CardTitle>
            <p className="text-xs text-slate-400">
              @{post.account.handle} • {CATEGORY_LABELS[post.account.category]} • {formatRelativeTime(post.postedAt)}
            </p>
          </div>
          <a
            href={post.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
          >
            Source <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="flex flex-wrap gap-1">
          {post.account.tags.map((tag) => (
            <Badge key={`${post.id}-${tag}`} variant="outline" className="border-slate-700 text-slate-300">
              {tag}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{clampText(post.content, 420)}</p>

        {post.summary ? (
          <div className="rounded-md border border-indigo-900/60 bg-indigo-950/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-300">AI why-it-matters</p>
            <p className="mt-1 text-sm text-indigo-100">{post.summary.summary}</p>
          </div>
        ) : (
          <div className="rounded-md border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-400">
            Summary pending.
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-4 border-t border-slate-800 pt-3 text-xs text-slate-300">
        <span className="inline-flex items-center gap-1">
          <Heart className="h-3.5 w-3.5" /> {formatNumber(post.likeCount)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" /> {formatNumber(post.replyCount)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Repeat2 className="h-3.5 w-3.5" /> {formatNumber(post.repostCount)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Quote className="h-3.5 w-3.5" /> {formatNumber(post.quoteCount ?? 0)}
        </span>
      </CardFooter>
    </Card>
  );
}
