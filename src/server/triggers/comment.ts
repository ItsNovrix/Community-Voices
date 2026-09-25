import type { Context } from 'hono';
import { reddit, redis, settings } from "@devvit/web/server";

export const handleCommentCreate = async (c: Context) => {
  try {
    const event = await c.req.json();
    if (!event.comment || !event.author?.name || !event.post?.id) return c.json({ success: true });

    const commentId = event.comment.id;
    const postId = event.post.id;
    const parentId = event.comment.parentId;
    const authorName = event.author.name;
    const commentBody = event.comment.body || "";

    // 1. TOP-LEVEL FILTER: Ignore nested replies completely
    if (!parentId.startsWith('t3_')) {
      return c.json({ success: true });
    }

    // 2. FETCH SETTINGS
    const pinnedSummaryEnabled = await settings.get<boolean>('pinnedSummary') ?? true;
    if (!pinnedSummaryEnabled) return c.json({ success: true });

    const ignoreCommand = await settings.get<string>('ignoreCommand') ?? '!ignore';
    if (commentBody.trim().toLowerCase().startsWith(ignoreCommand.toLowerCase())) {
      console.log(`[Skip] Comment started with ignore command: ${ignoreCommand}`);
      return c.json({ success: true });
    }

    const vipDescriptor = await settings.get<string>('vipDescriptor') ?? 'VIP users';
    const rawVipFlairs = await settings.get<string>('vipFlairs') ?? '';
    const rawVipUsernames = await settings.get<string>('vipUsernames') ?? '';
    
    const vipFlairs = rawVipFlairs.split(',').map(f => f.trim().toLowerCase()).filter(Boolean);
    const vipUsernames = rawVipUsernames.split(',').map(u => u.trim().toLowerCase()).filter(Boolean);

    // 3. VIP IDENTIFICATION
    let isVip = false;
    
    // Check Username
    if (vipUsernames.includes(authorName.toLowerCase())) {
      isVip = true;
    } else if (vipFlairs.length > 0) {
      // Fetch comment strictly to check author's flair
      const commentObj = await reddit.getCommentById(`t1_${commentId.replace(/^t1_/, '')}` as `t1_${string}`);
      const authorFlair = commentObj.authorFlair?.text?.toLowerCase() || "";
      if (authorFlair && vipFlairs.some(flair => authorFlair.includes(flair))) {
        isVip = true;
      }
    }

    if (!isVip) return c.json({ success: true });

    // 4. AGGREGATE VIP DATA IN REDIS
    const dataRedisKey = `vip_data_${postId}`;
    const existingData = await redis.get(dataRedisKey);
    let vipComments: Array<{ author: string, body: string, url: string }> = existingData ? JSON.parse(existingData) : [];

    // Truncate comment body for the blockquote (e.g., 250 chars max)
    let truncatedBody = commentBody.replace(/[\n\r]/g, " ").trim();
    if (truncatedBody.length > 250) truncatedBody = truncatedBody.substring(0, 247) + "...";

    vipComments.push({
      author: authorName,
      body: truncatedBody,
      url: `https://www.reddit.com${event.comment.permalink}`
    });

    await redis.set(dataRedisKey, JSON.stringify(vipComments));

    // 5. BUILD THE PINNED SUMMARY COMMENT
    const totalComments = vipComments.length;
    let summaryText = `**There are ${totalComments} comments from ${vipDescriptor} in this post:**\n\n---\n\n`;

    // Limit blockquotes to the first 5
    const displayLimit = 5;
    const commentsToDisplay = vipComments.slice(0, displayLimit);

    commentsToDisplay.forEach(c => {
      summaryText += `> [u/${c.author} commented:](${c.url}) ${c.body}\n\n`;
    });

    if (totalComments > displayLimit) {
      summaryText += `---\n\n**More replies:**\n`;
      for (let i = displayLimit; i < totalComments; i++) {
        summaryText += `${i + 1}. [u/${vipComments[i].author}'s reply](${vipComments[i].url})\n`;
      }
    }

    summaryText += `\n---\n*I am a bot, and this action was performed automatically.*`;

    // 6. POST OR EDIT THE STICKY COMMENT
    const pinnedIdKey = `pinned_summary_id_${postId}`;
    const existingPinnedId = await redis.get(pinnedIdKey);

    if (existingPinnedId) {
      // Edit existing comment
      const pinnedComment = await reddit.getCommentById(`t1_${existingPinnedId.replace(/^t1_/, '')}` as `t1_${string}`);
      await pinnedComment.edit({ text: summaryText });
    } else {
      // Create new pinned comment
      const newPinnedComment = await reddit.submitComment({
        id: `t3_${postId.replace(/^t3_/, '')}` as `t3_${string}`,
        text: summaryText
      });
      await newPinnedComment.distinguish(true);
      
      // We wrap the sticky command in a try/catch as standard practice
      try {
        await (newPinnedComment as any).sticky();
      } catch (e) {
        console.error("Failed to sticky the summary comment", e);
      }
      
      await redis.set(pinnedIdKey, newPinnedComment.id);
    }

    // 7. POST FLAIR AUTOMATION
    const setFlairEnabled = await settings.get<boolean>('setFlairAfterCommenting') ?? false;
    if (setFlairEnabled) {
      const targetFlairText = await settings.get<string>('vipCommentPostFlairText') ?? '';
      if (targetFlairText) {
        await reddit.setPostFlair({
          subredditName: event.subreddit.name,
          postId: `t3_${postId.replace(/^t3_/, '')}` as `t3_${string}`,
          text: targetFlairText
        });
      }
    }

    return c.json({ success: true });

  } catch (error) {
    console.error("[Error] Critical failure in handleCommentCreate:", error);
    return c.json({ error: String(error) }, 500);
  }
};