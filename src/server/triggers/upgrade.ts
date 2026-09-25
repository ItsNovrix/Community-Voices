import type { Context } from 'hono';
import { reddit, settings, scheduler } from "@devvit/web/server";

export const handleAppUpgrade = async (c: Context) => {
  try {
    const event = await c.req.json();
    console.log(`App upgrade payload received.`);

    const subreddit = await reddit.getCurrentSubreddit();
    const appAccount = await reddit.getAppUser();

    let firstMsg = `Hello r/${subreddit.name} mods,\n\n`;

    firstMsg += `Thanks for updating **Community Voices**!\n\n`;
    firstMsg += `App Description goes here!\n\n`;

    /* WHAT'S NEW */
    firstMsg += `**What's new (highlights):**\n\n\n`;
    firstMsg += `- Update 1\n`;
    firstMsg += `- Update 2\n`;
    firstMsg += `- Update 3\n\n`;

    /* REMINDERS */
    firstMsg += `**Good to know / reminders:**\n\n\n`;
    firstMsg += `- Reminder 1\n\n`;
    firstMsg += `- Reminder 2\n\n`;
    firstMsg += `- Reminder 3\n\n`;

    /* CONFIG LINKS */
    firstMsg += `**Configure now:** manage **Community Voices** settings here → [Community Voices settings](https://developers.reddit.com/r/${subreddit.name}/apps/community-voices)\n\n\n`;

    /* FOOTER */
    firstMsg += `[Terms & Conditions](https://www.reddit.com/r/NovrixApps/wiki/community-voices/terms-and-conditions) | `;
    firstMsg += `[Privacy Policy](https://www.reddit.com/r/NovrixApps/wiki/community-voices/privacy-policy/) | `;
    firstMsg += `[Contact](https://www.reddit.com/r/NovrixApps/)\n\n`;

    await reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: subreddit.name,
      to: "community-voices",
      subject: `Community Voices: App Update`,
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
    console.error("Crash prevented in AppUpgrade trigger:", error);
    return c.json({ success: false, error: String(error) });
  }
};