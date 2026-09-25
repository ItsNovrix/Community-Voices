import type { Context } from 'hono';
import { reddit, settings } from "@devvit/web/server";

export const handlePostSubmit = async (c: Context) => {
  try {
    const event = await c.req.json();
    
    // Ensure we have a valid post payload
    if (!event.post || !event.author?.name) {
      return c.json({ success: true });
    }

    const postId = event.post.id;
    const authorName = event.author.name;

    // 1. FETCH VIP SETTINGS
    const rawVipFlairs = await settings.get<string>('vipFlairs') ?? '';
    const rawVipUsernames = await settings.get<string>('vipUsernames') ?? '';
    
    const vipFlairs = rawVipFlairs.split(',').map(f => f.trim().toLowerCase()).filter(Boolean);
    const vipUsernames = rawVipUsernames.split(',').map(u => u.trim().toLowerCase()).filter(Boolean);

    // Fetch the full post to access the author's flair natively[cite: 3]
    // We enforce the strict t3_ template literal type to prevent compiler errors[cite: 3]
    const postObj = await reddit.getPostById(`t3_${postId.replace(/^t3_/, '')}` as `t3_${string}`);

    // 2. VIP IDENTIFICATION
    let isVip = false;
    
    if (vipUsernames.includes(authorName.toLowerCase())) {
      isVip = true;
    } else if (vipFlairs.length > 0) {
      // Safely target the nested text property before converting to lowercase
      const authorFlair = postObj.authorFlair?.text?.toLowerCase() || "";
      if (authorFlair && vipFlairs.some(flair => authorFlair.includes(flair))) {
        isVip = true;
      }
    }

    // If they aren't a VIP, we silently skip
    if (!isVip) {
      return c.json({ success: true });
    }

    // 3. POST FLAIR AUTOMATION
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

    // 4. POST STICKY AUTOMATION
    const autoStickySetting = await settings.get<string>('autoStickyVipPosts') ?? 'none';
    if (autoStickySetting !== 'none') {
      try {
        // We cast as `any` again to bypass potential missing SDK definitions for specific sticky slots[cite: 3]
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