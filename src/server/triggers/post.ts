import type { Context } from 'hono';
import { reddit, settings } from "@devvit/web/server";

export const handlePostSubmit = async (c: Context) => {
  try {
    const event = await c.req.json();
    
    if (!event.post || !event.author?.name) {
      return c.json({ success: true });
    }

    const postId = event.post.id;
    const authorName = event.author.name;

    const rawVipFlairs = await settings.get<string>('vipFlairs') ?? '';
    const rawVipUsernames = await settings.get<string>('vipUsernames') ?? '';
    
    const vipFlairs = rawVipFlairs.split(',').map(f => f.trim().toLowerCase()).filter(Boolean);
    const vipUsernames = rawVipUsernames.split(',').map(u => u.trim().toLowerCase()).filter(Boolean);

    const postObj = await reddit.getPostById(`t3_${postId.replace(/^t3_/, '')}` as `t3_${string}`);

    let isVip = false;
    
    if (vipUsernames.includes(authorName.toLowerCase())) {
      isVip = true;
    } else if (vipFlairs.length > 0) {

      const authorFlair = postObj.authorFlair?.text?.toLowerCase() || "";
      if (authorFlair && vipFlairs.some(flair => authorFlair.includes(flair))) {
        isVip = true;
      }
    }

    if (!isVip) {
      return c.json({ success: true });
    }

    const setFlairEnabled = await settings.get<boolean>('setFlairAfterPosting') ?? false;
    if (setFlairEnabled) {
      const targetFlairText = await settings.get<string>('vipPostFlairText') ?? '';
      if (targetFlairText) {
        await reddit.setPostFlair({
          subredditName: event.subreddit.name,
          postId: postObj.id,
          text: targetFlairText
        });
      }
    }

    const autoStickySetting = await settings.get<string>('autoStickyVipPosts') ?? 'none';
    if (autoStickySetting !== 'none') {
      try {
        if (autoStickySetting === '1') {
          await (postObj as any).sticky({ num: 1 });
        } else if (autoStickySetting === '2') {
          await (postObj as any).sticky({ num: 2 });
        }
      } catch (e) {
        console.error("Failed to auto-sticky VIP post:", e);
      }
    }

    return c.json({ success: true });

  } catch (error) {
    console.error("[Error] Critical failure in handlePostSubmit:", error);
    return c.json({ error: String(error) }, 500);
  }
};