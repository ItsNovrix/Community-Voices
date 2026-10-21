import type { Context } from 'hono';
import { reddit, settings, scheduler } from "@devvit/web/server";

export const handleAppInstall = async (c: Context) => {
  try {
    const event = await c.req.json();
    console.log(`App install payload received.`);

    const subreddit = await reddit.getCurrentSubreddit();
    const appAccount = await reddit.getAppUser();

    let firstMsg = `Hello r/${subreddit.name} mods,\n\n`;

    firstMsg += `Thanks for installing **Community Voices**!\n\n`;
    firstMsg += `Community Voices highlights comments made by important users within your community!\n\n`;

    /* QUICK START */
    firstMsg += `**How to use Community Voices:**\n\n\n`;
    firstMsg += `1) Set user flairs/usernames that will be used to identify users the app should target.\n`;
    firstMsg += `2) Set the VIP descriptor to define how VIP users are described in your community.\n`;
    firstMsg += `3) Configure how the app will react when VIP users post/comment.\n\n`;
    firstMsg += `4) Done!\n\n`;
    firstMsg += `*Note:* You can optionally set a custom command users can include in their posts/comments to have the bot ignore them.\n`;

    /* DEFAULTS & NOTIFICATIONS */
    firstMsg += `**Defaults & notifications:**\n\n\n`;
    firstMsg += `- An **internal mod note** is added automatically after all actions performed by Comment Daemon\n`;
    firstMsg += `- **Pinned summary comments are OFF by default** but can easily be enabled in the app settings.\n`;
    firstMsg += `- **Comment replies targeting is OFF by default** but can easily be enabled in the app settings.\n`;
    firstMsg += `- The default ignore command is **!ignore**. You can customize this command in the app settings.\n\n`;

    /* FEATURES */
    firstMsg += `**Features you can use today:**\n\n\n`;
    firstMsg += `- Target VIP users by **user flair** (comma-separated list).\n`;
    firstMsg += `- Target VIP users by **username** (comma-separated list).\n`;
    firstMsg += `- Pin a summary comment on posts summarizing all comments made by VIP users.\n`;
    firstMsg += `- Include replies to other comments in pinned comment summaries.\n`;
    firstMsg += `- Update post flair when a VIP user comments on a post.\n`;
    firstMsg += `- Auto-sticky posts made by VIP users.\n\n`;

    /* CONFIG LINKS */
    firstMsg += `**Configure now:** manage your **Community Voices** settings here → `;
    firstMsg += `[Community Voices settings](https://developers.reddit.com/r/${subreddit.name}/apps/community-voices)\n\n`;

    /* FOOTER */
    firstMsg += `[Terms & Conditions](https://www.reddit.com/r/NovrixApps/wiki/community-voices/terms-and-conditions) | `;
    firstMsg += `[Privacy Policy](https://www.reddit.com/r/NovrixApps/wiki/community-voices/privacy-policy/) | `;
    firstMsg += `[Feedback/Support](https://reddit.com/r/NovrixApps) | `,
	  firstMsg += `[Novrix Labs Trello Board](https://trello.com/b/1TdocvRg/novrix-labs)\n\n`;

    await reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: "community-voices",
      subject: `Thanks for installing Community Voices!`,
      text: firstMsg,
    });
    console.log(`Message sent to r/${subreddit.name} mods.`);

      await reddit.setUserFlair({
        subredditName: subreddit.name,
        username: appAccount!.username,
        text: "Mod Team 🛡️",
        textColor: "light",
        backgroundColor: "#2200ff",
      });

      try {
        await scheduler.runJob({
          name: 'upgrade_notifier_job',
          cron: '*/30 * * * *',
        });
        console.log("30-minute upgrade checker timer started.");
      } catch (e) {
        console.error("Failed to start timer:", e);
      }

    return c.json({ success: true });
  } catch (error) {
    console.error("Crash prevented in AppInstall trigger:", error);
    return c.json({ success: false, error: String(error) }); 
  }
};