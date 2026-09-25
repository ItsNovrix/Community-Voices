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
    firstMsg += `1) Step one.\n`;
    firstMsg += `2) Step two.\n`;
    firstMsg += `3) Step three — done!\n\n`;
    firstMsg += `*Note:* Add any important notes here!n\n`;

    /* DEFAULTS & NOTIFICATIONS */
    firstMsg += `**Defaults:**\n\n\n`;
    firstMsg += `- Info line 1\n`;
    firstMsg += `- Info line 2\n`;
    firstMsg += `- Info line 3\n\n`;

    /* FEATURES */
    firstMsg += `**Features you can use today:**\n\n\n`;
    firstMsg += `- Feature 1\n`;
    firstMsg += `- Feature 2\n`;
    firstMsg += `- Feature 3\n\n`;

    /* CONFIG LINKS */
    firstMsg += `**Configure now:** manage your **Community Voices** settings here → `;
    firstMsg += `[Community Voices settings](https://developers.reddit.com/r/${subreddit.name}/apps/community-voices)\n\n`;

    /* FOOTER */
    firstMsg += `[Terms & Conditions](https://www.reddit.com/r/NovrixApps/wiki/community-voices/terms-and-conditions) | `;
    firstMsg += `[Privacy Policy](https://www.reddit.com/r/NovrixApps/wiki/community-voices/privacy-policy/) | `;
    firstMsg += `[Contact](https://www.reddit.com/r/NovrixApps/)\n\n`;

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