import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const copyScreenshotToClipboard = async (page: Page, screenshotBase64: string) => {
  await page.evaluate(async (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }

    const blob = new Blob([bytes], { type: 'image/png' });
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
  }, screenshotBase64);
};

const pasteClipboardImage = async (
  page: Page,
  composer: Locator,
  sendButton: Locator,
  skipPromptRequired = false,
  messageText?: string,
) => {
  await composer.click();
  await expect(composer).toBeFocused();
  if (messageText) {
    await composer.fill(messageText);
  }
  await composer.press('Control+V');

  const skipButton = page.getByRole('button', { name: 'Skip', exact: true });
  if (skipPromptRequired) {
    await expect(skipButton).toBeVisible({ timeout: 60_000 });
    await skipButton.click();
    await page.waitForTimeout(2_000);
  } else if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click();
  }

  await expect(sendButton).toBeEnabled({ timeout: 60_000 });
  await sendButton.click();
};

const forwardMessageToRecipient = async (
  page: Page,
  hoverTarget: Locator,
  messageOptionsButton: Locator,
  recipientName: string,
) => {
  await expect(hoverTarget).toBeVisible({ timeout: 60_000 });
  await hoverTarget.hover();

  await expect(messageOptionsButton).toBeVisible({ timeout: 60_000 });
  await messageOptionsButton.click();

  const messageMenu = page.getByRole('menu').last();
  await expect(messageMenu).toBeVisible({ timeout: 30_000 });
  const forwardOption = messageMenu.getByRole('menuitem', { name: /^forward$/i }).last();
  await expect(forwardOption).toBeVisible({ timeout: 60_000 });
  await forwardOption.click();

  const forwardDialog = page.locator('chat-message-forward').last();
  await expect(forwardDialog).toBeVisible({ timeout: 30_000 });

  const recipientSearch = forwardDialog.getByRole('textbox', { name: 'Search', exact: true });
  await expect(recipientSearch).toBeVisible({ timeout: 30_000 });
  await recipientSearch.fill(recipientName);

  const recipient = forwardDialog.getByRole('button', {
    name: recipientName,
    exact: true,
  }).last();
  await expect(recipient).toBeVisible({ timeout: 60_000 });
  await recipient.click();

  const finalForwardButton = forwardDialog.getByTestId('message-forward__submit');
  await expect(finalForwardButton).toBeVisible({ timeout: 60_000 });
  await expect(finalForwardButton).toBeEnabled({ timeout: 30_000 });

  const forwardedCards = page.getByRole('button', { name: 'See every message in this forward' });
  const forwardedCardCountBeforeSend = await forwardedCards.count();
  await finalForwardButton.click();

  await expect(forwardDialog).toBeHidden({ timeout: 60_000 });
  await expect(forwardedCards).toHaveCount(forwardedCardCountBeforeSend + 1, { timeout: 60_000 });
  const forwardedMessage = page.getByRole('article')
    .filter({ has: forwardedCards.last() })
    .last();
  const forwardedText = forwardedMessage.getByText('Forwarded', { exact: true }).last();
  await expect(forwardedText).toBeVisible({ timeout: 60_000 });
  await forwardedMessage.scrollIntoViewIfNeeded();
  await expect(forwardedText).toBeInViewport({ ratio: 1, timeout: 30_000 });

  return forwardedMessage;
};

test.use({
  viewport: { width: 1440, height: 768 },
  video: { mode: 'on', size: { width: 1440, height: 768 } },
});

test('Yoodle Automation', async ({ page, context, browserName }, testInfo) => {
  test.setTimeout(1_200_000);

  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'https://qa.ss.set.digitalharbor.us',
    });
  }

  await page.addInitScript(() => {
    const showUrl = () => {
      let urlBar = document.getElementById('automation-url-bar');
      if (!urlBar) {
        urlBar = document.createElement('div');
        urlBar.id = 'automation-url-bar';
        urlBar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:28px;z-index:2147483647;background:#172033;color:#fff;font:12px Arial,sans-serif;padding:7px 14px;box-sizing:border-box;border-bottom:1px solid #34d399;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;';
        document.documentElement.appendChild(urlBar);
      }
      urlBar.textContent = `URL: ${window.location.href}`;
    };

    window.addEventListener('DOMContentLoaded', showUrl);
    window.addEventListener('load', showUrl);
    window.addEventListener('popstate', showUrl);
  });

  const attachScreenshot = async (name: string, fullPage = true) => {
    const screenshotPath = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage });
    await testInfo.attach(name, { path: screenshotPath, contentType: 'image/png' });
    return screenshotPath;
  };

  await page.goto('https://qa.ss.set.digitalharbor.us/yoodle-new/secure/chat', {
    waitUntil: 'domcontentloaded',
  });

  const emailInput = page.getByPlaceholder('Email');
  await expect(emailInput).toBeVisible({ timeout: 60_000 });
  await emailInput.fill('anil.kakamari@yopmail.com');

  await page.getByPlaceholder('Password').fill('Password1!');
  await page.getByRole('button', { name: 'Login', exact: true }).click();

  const searchInput = page.getByRole('combobox', {
    name: 'Search conversations and messages',
  });
  const markedResult = page.getByRole('option', {
    name: /Chetan Patil/i,
  }).first();

  const previousResult = page.getByRole('button', {
    name: /Chetan Patil/i,
  }).first();

  if (await searchInput.isVisible()) {
    await searchInput.fill('Chetan Patil');

    if (await markedResult.isVisible().catch(() => false)) {
      await markedResult.click();
    } else {
      await expect(previousResult).toBeVisible({ timeout: 60_000 });
      await previousResult.click();
    }
  } else {
    await expect(previousResult).toBeVisible({ timeout: 60_000 });
    await previousResult.click();
  }

  const messageComposer = page.getByRole('textbox', { name: /write your message/i })
    .or(page.getByPlaceholder(/write your message/i))
    .or(page.locator('[data-testid="message-composer"], .message-composer').getByRole('textbox'));
  await expect(messageComposer).toBeVisible({ timeout: 60_000 });

  const sendButton = page.getByTestId('message-composer__send')
    .or(page.getByRole('button', { name: /send/i }));
  const fileInput = page.locator('input[type="file"]').last();

  await test.step('Scenario 1: Verify user can send a text message', async () => {
    await messageComposer.fill('Test Automation');
    await sendButton.click();
    await page.waitForTimeout(5_000);

    await expect(page.getByText('Test Automation', { exact: true }).last()).toBeVisible({ timeout: 60_000 });
    await attachScreenshot('test-automation-message-sent');
  });

  await test.step('Scenario 2: Verify user can send a screenshot', async () => {
    const screenshotPath = testInfo.outputPath('test-automation-message-sent.png');

    if (await fileInput.count()) {
      await fileInput.setInputFiles(screenshotPath);
    } else {
      const attachmentButton = page.getByRole('button', {
        name: /attach|attachment|upload|paperclip/i,
      }).last();
      await expect(attachmentButton).toBeVisible({ timeout: 60_000 });

      const fileChooserPromise = page.waitForEvent('filechooser');
      await attachmentButton.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(screenshotPath);
    }

    await sendButton.click();
    await page.waitForTimeout(5_000);
    await expect(page.getByRole('article').last()).toBeVisible({ timeout: 60_000 });
    await attachScreenshot('Screenshot-message-sent');
  });

  await test.step('Scenario 3: Verify user can upload and send an image', async () => {
    const downloadedImage = String.raw`C:\Users\ChetanPatil\Downloads\images (8).jpg`;

    if (await fileInput.count()) {
      await fileInput.setInputFiles(downloadedImage);
    } else {
      const attachmentButton = page.getByRole('button', {
        name: /attach|attachment|upload|paperclip/i,
      }).last();
      await expect(attachmentButton).toBeVisible({ timeout: 60_000 });

      const fileChooserPromise = page.waitForEvent('filechooser');
      await attachmentButton.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(downloadedImage);
    }

    await sendButton.click();
    await page.waitForTimeout(5_000);
    await expect(page.getByRole('article').last()).toBeVisible({ timeout: 60_000 });
    await attachScreenshot('Uploaded-image-sent');
  });

  await test.step('Scenario 4: Verify user can send the Task micro app', async () => {
    await messageComposer.fill('task');

    const taskMenuItem = page.getByText('Task', { exact: true }).last();
    await expect(taskMenuItem).toBeVisible({ timeout: 60_000 });
    await taskMenuItem.click();

    const taskInput = page.getByRole('textbox', { name: 'Task', exact: true });
    await expect(taskInput).toBeVisible({ timeout: 60_000 });
    await taskInput.click();
    await taskInput.fill('please verify this');
    await expect(taskInput).toHaveText('please verify this');

    await expect(sendButton).toBeEnabled({ timeout: 60_000 });
    await sendButton.click();

    await expect(page.getByText('please verify this', { exact: true }).last()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(7_000);
    await attachScreenshot('task-message-sent');
  });

  await messageComposer.fill('set reminder test');

  const reminderTab = page.getByText('Reminder', { exact: true }).last();
  await expect(reminderTab).toBeVisible({ timeout: 60_000 });
  await reminderTab.click();

  const customReminder = page.getByText('Custom', { exact: true }).last();
  await customReminder.scrollIntoViewIfNeeded();
  await expect(customReminder).toBeVisible({ timeout: 60_000 });
  await customReminder.click();

  const reminderDate = page.locator('input[type="date"]').last();
  await expect(reminderDate).toBeVisible({ timeout: 60_000 });
  await reminderDate.click();
  const today = new Date();
  const todayDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  await reminderDate.fill(todayDate);

  const createReminderButton = page.getByRole('button', { name: /create/i }).last();
  await createReminderButton.scrollIntoViewIfNeeded();
  await expect(createReminderButton).toBeEnabled({ timeout: 60_000 });
  await createReminderButton.click();

  await expect(sendButton).toBeEnabled({ timeout: 60_000 });
  await sendButton.click();
  await page.waitForTimeout(2_000);
  const sentReminder = page.getByText('set reminder test', { exact: true }).last();
  await expect(sentReminder).toBeVisible({ timeout: 60_000 });
  const reminderConfirmation = page.getByText(/Reminder set for/i).last();
  await expect(reminderConfirmation).toBeVisible({ timeout: 60_000 });
  const reminderArticle = page.getByRole('article').filter({ has: sentReminder }).last();
  await expect(reminderArticle).toContainText('Reminder set for');
  await reminderArticle.scrollIntoViewIfNeeded();
  await attachScreenshot('custom-reminder-sent');

  await messageComposer.fill('poll');

  const pollMenuItem = page.getByRole('button', {
    name: 'Multiple-choice poll',
    exact: true,
  });
  await expect(pollMenuItem).toBeVisible({ timeout: 60_000 });
  await pollMenuItem.click();

  const pollQuestion = page.getByRole('textbox', { name: 'Question', exact: true })
    .or(page.getByPlaceholder(/type your (review|view)/i));
  await expect(pollQuestion).toBeVisible({ timeout: 60_000 });
  await pollQuestion.fill('please poll this');

  const option1 = page.getByRole('textbox', { name: 'Option 1', exact: true })
    .or(page.getByPlaceholder(/type option 1/i));
  await expect(option1).toBeVisible({ timeout: 60_000 });
  await option1.fill('YES');

  const option2 = page.getByRole('textbox', { name: 'Option 2', exact: true })
    .or(page.getByPlaceholder(/type option 2/i));
  await expect(option2).toBeVisible({ timeout: 60_000 });
  await option2.fill('NO');

  await sendButton.click();
  await page.waitForTimeout(5_000);
  await attachScreenshot('Multiple-choice-poll-Microapp-sent');

  await messageComposer.fill('poll');

  const yesNoPoll = page.getByRole('button', {
    name: 'Yes / No poll',
    exact: true,
  });
  await expect(yesNoPoll).toBeVisible({ timeout: 60_000 });
  await yesNoPoll.click();

  const queryInput = page.getByRole('textbox', { name: /query|question/i })
    .or(page.getByPlaceholder(/your query|query/i));
  await expect(queryInput).toBeVisible({ timeout: 60_000 });
  await queryInput.fill('Query');

  await sendButton.click();
  await page.waitForTimeout(5_000);
  await attachScreenshot('Yes or No-poll-Microapp-sent');

  await messageComposer.fill('rating');

  const ratingPoll = page.getByRole('button', {
    name: 'Rating poll',
    exact: true,
  });
  await expect(ratingPoll).toBeVisible({ timeout: 60_000 });
  await ratingPoll.click();

  const ratingQuery = page.getByRole('textbox', { name: /query|question/i })
    .or(page.getByPlaceholder(/your query|query/i));
  await expect(ratingQuery).toBeVisible({ timeout: 60_000 });
  await ratingQuery.fill('Your rating Query');

  await sendButton.click();
  await page.waitForTimeout(5_000);
  await attachScreenshot('Rating-poll-Microapp-sent');

  await messageComposer.fill('feedback');

  const feedbackPoll = page.getByRole('button', {
    name: 'Feedback poll',
    exact: true,
  });
  await expect(feedbackPoll).toBeVisible({ timeout: 60_000 });
  await feedbackPoll.click();

  const feedbackQuery = page.getByRole('textbox', { name: /query|question/i })
    .or(page.getByPlaceholder(/your query|query/i));
  await expect(feedbackQuery).toBeVisible({ timeout: 60_000 });
  await feedbackQuery.fill('Give your Feedback');

  await sendButton.click();
  await page.waitForTimeout(5_000);
  await attachScreenshot('Feedback-poll-Microapp-sent');

  await messageComposer.fill('meet');

  const meetingOffer = page.getByRole('button', {
    name: 'Meeting',
    exact: true,
  });
  await expect(meetingOffer).toBeVisible({ timeout: 60_000 });
  await meetingOffer.click();

  const meetingTitle = page.getByRole('textbox', { name: /meeting title|title/i })
    .or(page.getByPlaceholder(/meeting title|title/i));
  await expect(meetingTitle).toBeVisible({ timeout: 60_000 });
  await meetingTitle.fill('Test from Automation');

  const createButton = page.getByRole('button', { name: /create/i }).last();
  await createButton.scrollIntoViewIfNeeded();
  await expect(createButton).toBeVisible({ timeout: 60_000 });
  await expect(createButton).toBeEnabled({ timeout: 60_000 });
  await createButton.click();

  await sendButton.click();
  await page.waitForTimeout(5_000);
  await attachScreenshot('Meeting-Microapp-sent');

  const discardDraft = page.getByRole('button', { name: 'Discard draft', exact: true });
  if (await discardDraft.isVisible().catch(() => false)) {
    await discardDraft.click();
  }

  const longMessage = 'Please review this Message before the Test starts. The team identified a Bug in the login flow, including a Critical Bug that may block access. Kindly verify the fix, confirm the expected behavior, and share updated results? This Question mark indicates uncertainty, so please respond with clear validation notes today.';

  await messageComposer.fill(longMessage);
  await sendButton.click();
  await expect(page.getByText(longMessage, { exact: true }).last()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(5_000);

  await messageComposer.click();
  await attachScreenshot('Long-message-sent');

  const newThreadButton = page.getByRole('button', { name: /new thread/i }).last();
  await expect(newThreadButton).toBeVisible({ timeout: 60_000 });
  await newThreadButton.click();

  const untitledThreadHeading = page.getByText('Untitled thread', { exact: true }).last();
  await expect(untitledThreadHeading).toBeVisible({ timeout: 60_000 });
  await untitledThreadHeading.hover();

  const editThreadButton = page.getByRole('button', { name: /edit|rename|pencil/i }).last();
  await expect(editThreadButton).toBeVisible({ timeout: 60_000 });
  await editThreadButton.click();

  await page.keyboard.press('Control+A');
  await page.keyboard.type('Automation Thread');
  await page.keyboard.press('Enter');

  const threadComposer = page.getByRole('textbox', { name: /write your message/i })
    .or(page.getByPlaceholder(/write your message/i))
    .or(page.locator('[data-testid="message-composer"], .message-composer').getByRole('textbox'));
  const visibleThreadComposer = threadComposer.last();
  await expect(visibleThreadComposer).toBeVisible({ timeout: 60_000 });
  await visibleThreadComposer.click();
  await visibleThreadComposer.fill('Automation');
  await expect(visibleThreadComposer).toHaveText('Automation');

  const threadSendButton = page.getByTestId('message-composer__send')
    .or(page.getByRole('button', { name: /^send$/i }));
  const visibleThreadSendButton = threadSendButton.last();
  await visibleThreadComposer.press('Enter');
  await page.waitForTimeout(2_000);

  if ((await visibleThreadComposer.textContent())?.includes('Automation')) {
    await expect(visibleThreadSendButton).toBeVisible({ timeout: 60_000 });
    await expect(visibleThreadSendButton).toBeEnabled({ timeout: 60_000 });
    await visibleThreadSendButton.click();
    await page.waitForTimeout(3_000);
  }

  await expect(page.getByText('Automation Thread', { exact: true }).last()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Automation', { exact: true }).last()).toBeVisible({ timeout: 60_000 });
  await attachScreenshot('Thread-creation-message-sent');

  const closeThreadPanel = page.getByRole('button', { name: 'Close', exact: true }).last();
  if (await closeThreadPanel.isVisible().catch(() => false)) {
    await closeThreadPanel.click();
  }

  const chetanChatTab = page.getByRole('tab', { name: /Chetan Patil/i }).first();
  await expect(chetanChatTab).toBeVisible({ timeout: 60_000 });
  await chetanChatTab.click();

  const chetanComposer = page.getByRole('textbox', { name: /write your message/i }).first();
  await expect(chetanComposer).toBeVisible({ timeout: 60_000 });
  await chetanComposer.click();
  await chetanComposer.fill('WOW');

  const chetanSendButton = page.getByTestId('message-composer__send').first()
    .or(page.getByRole('button', { name: /^send$/i }).first());
  await expect(chetanSendButton).toBeEnabled({ timeout: 60_000 });
  await chetanSendButton.click();

  const messagesLog = page.getByRole('log', { name: 'Messages' });
  const wowMessage = messagesLog.getByText('WOW', { exact: true }).last();
  await expect(wowMessage).toBeVisible({ timeout: 60_000 });

  const wowArticle = wowMessage.locator(
    'xpath=ancestor::*[self::article or @role="article"][1]',
  );
  await expect(wowArticle).toBeVisible({ timeout: 60_000 });
  await wowMessage.hover();

  const heartButton = wowArticle.getByRole('toolbar', { name: 'Quick reactions' })
    .getByRole('button', { name: /red heart/i }).first();
  await expect(heartButton).toBeVisible({ timeout: 60_000 });
  await heartButton.click({ force: true });
  await page.waitForTimeout(3_000);

  const redHeartReaction = wowArticle.getByRole('button', { name: /red heart/i })
    .or(wowArticle.locator('button').filter({ hasText: /❤|♥|❤️/ }));
  await expect(redHeartReaction.first()).toBeVisible({ timeout: 60_000 });
  await attachScreenshot('WOW-message-heart-reacted');

  const wowScreenshot = await page.screenshot({ fullPage: true });
  await copyScreenshotToClipboard(page, wowScreenshot.toString('base64'));
  await pasteClipboardImage(page, chetanComposer, chetanSendButton, true);
  await page.waitForTimeout(5_000);
  await attachScreenshot('WOW-heart-screenshot-pasted-and-sent');

  const companionPanel = page.getByRole('region', { name: 'Companion panel' });
  const closeMediaViewer = companionPanel.getByRole('button', { name: 'Close', exact: true });
  await expect(closeMediaViewer).toBeVisible({ timeout: 30_000 });
  await closeMediaViewer.click();

  await chetanComposer.click();
  await chetanComposer.fill('Thank You');
  await expect(chetanSendButton).toBeEnabled({ timeout: 60_000 });
  await chetanSendButton.click();

  const thankYouMessage = page.getByText('Thank You', { exact: true }).last();
  await expect(thankYouMessage).toBeVisible({ timeout: 60_000 });

  const thankYouArticle = page.getByRole('article').filter({ has: thankYouMessage }).last();
  await expect(thankYouArticle).toBeVisible({ timeout: 60_000 });
  await thankYouMessage.hover();

  const quickReactionToolbar = thankYouArticle.getByRole('toolbar', { name: 'Quick reactions' });
  await expect(quickReactionToolbar).toBeVisible({ timeout: 60_000 });

  const thumbsUpButton = quickReactionToolbar.getByRole('button', {
    name: 'Thumbs Up',
    exact: true,
  });
  await expect(thumbsUpButton).toBeVisible({ timeout: 60_000 });
  await thumbsUpButton.click({ force: true });
  await page.waitForTimeout(5_000);

  const appliedLike = thankYouArticle.getByRole('toolbar', { name: 'Reactions' })
    .getByRole('button', { name: /Thumbs Up/i }).first();
  await expect(appliedLike).toBeVisible({ timeout: 60_000 });
  await attachScreenshot('Thank-you-message-liked');

  await chetanComposer.fill('Check This');
  await expect(chetanSendButton).toBeEnabled({ timeout: 60_000 });
  await chetanSendButton.click();

  const checkMessage = page.getByText('Check This', { exact: true }).last();
  await expect(checkMessage).toBeVisible({ timeout: 60_000 });
  const checkMessageArticle = page.getByRole('article').filter({ has: checkMessage }).last();
  await expect(checkMessageArticle).toBeVisible({ timeout: 60_000 });
  await checkMessage.hover();

  const messageOptionsButton = checkMessageArticle.getByRole('button', {
    name: 'Message options',
  });
  await expect(messageOptionsButton).toBeVisible({ timeout: 60_000 });
  await messageOptionsButton.click();
  const addCommentOption = page.getByRole('menuitem', { name: /add comment/i })
    .or(page.getByText('Add comment', { exact: true })).last();
  await expect(addCommentOption).toBeVisible({ timeout: 30_000 });
  await addCommentOption.click();

  const commentEditor = checkMessageArticle.locator('[contenteditable="true"]');
  await expect(commentEditor).toBeVisible({ timeout: 30_000 });
  await commentEditor.fill('Okey');

  const commentComposer = commentEditor.locator('xpath=ancestor::*[.//button][1]');
  const commentButtons = commentComposer.getByRole('button');
  const commentButtonCount = await commentButtons.count();
  expect(commentButtonCount).toBeGreaterThanOrEqual(2);
  const sendCommentButton = commentButtons.nth(commentButtonCount - 2);
  await expect(sendCommentButton).toBeVisible({ timeout: 30_000 });
  await expect(sendCommentButton).toBeEnabled({ timeout: 30_000 });
  await sendCommentButton.click();

  const sentComment = page.getByText('Okey', { exact: true }).last();
  await expect(sentComment).toBeVisible({ timeout: 60_000 });
  await expect(sentComment).toBeInViewport({ ratio: 1, timeout: 60_000 });
  await page.waitForTimeout(3_000);
  await attachScreenshot('Inline-reply-message-sent', false);

  await chetanComposer.fill('Reply to this');
  await expect(chetanSendButton).toBeEnabled({ timeout: 60_000 });
  await chetanSendButton.click();

  const replyToThisMessage = page.getByText('Reply to this', { exact: true }).last();
  await expect(replyToThisMessage).toBeVisible({ timeout: 60_000 });
  const replyToThisArticle = page.getByRole('article').filter({ has: replyToThisMessage }).last();
  await expect(replyToThisArticle).toBeVisible({ timeout: 60_000 });
  await replyToThisMessage.hover();

  const replyMessageOptions = replyToThisArticle.getByRole('button', {
    name: 'Message options',
  });
  await expect(replyMessageOptions).toBeVisible({ timeout: 60_000 });
  await replyMessageOptions.click({ force: true });
  await page.getByRole('menuitem', { name: /^reply$/i })
    .or(page.getByText('Reply', { exact: true })).last().click();

  const replyComposer = page.locator('chat-message-composer').last();
  const replyEditor = replyComposer.locator('[contenteditable="true"]:visible');
  await expect(replyEditor).toBeVisible({ timeout: 30_000 });
  await replyEditor.fill('Replied');

  const replySendButton = page.getByTestId('message-composer__send').last()
    .or(page.getByRole('button', { name: /^send$/i }).last());
  await expect(replySendButton).toBeVisible({ timeout: 30_000 });
  await expect(replySendButton).toBeEnabled({ timeout: 30_000 });
  await replySendButton.click();
  await page.waitForTimeout(1_000);
  const repliedMessage = page.getByText('Replied', { exact: true }).last();
  await expect(repliedMessage).toBeVisible({ timeout: 60_000 });
  await repliedMessage.scrollIntoViewIfNeeded();
  await expect(repliedMessage).toBeInViewport({ ratio: 1, timeout: 30_000 });
  await attachScreenshot('Reply-to-message-sent', false);

  await test.step('Scenario 18: Verify user can forward a message', async () => {
    const messageToForward = 'Forward Message';
    await chetanComposer.fill(messageToForward);
    await expect(chetanSendButton).toBeEnabled({ timeout: 60_000 });
    await chetanSendButton.click();

    const sourceMessage = page.getByText(messageToForward, { exact: true }).last();
    await expect(sourceMessage).toBeVisible({ timeout: 60_000 });
    const sourceArticle = page.getByRole('article').filter({ has: sourceMessage }).last();
    await expect(sourceArticle).toBeVisible({ timeout: 60_000 });
    const forwardedMessage = await forwardMessageToRecipient(
      page,
      sourceMessage,
      sourceArticle.getByRole('button', { name: 'Message options' }),
      'Chetan Patil',
    );
    await expect(forwardedMessage).toContainText(messageToForward);
    await attachScreenshot('Forward-message-sent');
  });

  await test.step('Scenario 19: Verify user can copy-paste a screenshot and forward it to Chetan Patil', async () => {
    const screenshot = await page.screenshot({ fullPage: true });
    await copyScreenshotToClipboard(page, screenshot.toString('base64'));
    await pasteClipboardImage(page, chetanComposer, chetanSendButton);
    await page.waitForTimeout(5_000);

    const screenshotImage = page.getByRole('img', { name: 'thumbnail image' }).last();
    const messageOptionsButton = page.getByRole('button', { name: 'Message options' }).last();
    await forwardMessageToRecipient(
      page,
      screenshotImage,
      messageOptionsButton,
      'Chetan Patil',
    );
    await attachScreenshot('Copy-paste-screenshot-forwarded');
  });

  await test.step('Scenario 20: Send and forward a message with text and screenshot', async () => {
    const messageText = 'Check this';
    const screenshot = await page.screenshot({ fullPage: true });
    await copyScreenshotToClipboard(page, screenshot.toString('base64'));
    await pasteClipboardImage(page, chetanComposer, chetanSendButton, false, messageText);
    await page.waitForTimeout(5_000);

    const sourceMessage = page.getByText(messageText, { exact: true }).last();
    await expect(sourceMessage).toBeVisible({ timeout: 60_000 });
    const sourceArticle = page.getByRole('article').filter({ has: sourceMessage }).last();
    await expect(sourceArticle.getByRole('img', { name: 'thumbnail image' })).toBeVisible({
      timeout: 60_000,
    });

    const forwardedMessage = await forwardMessageToRecipient(
      page,
      sourceArticle.getByRole('img', { name: 'thumbnail image' }).last(),
      page.getByRole('button', { name: 'Message options' }).last(),
      'Chetan Patil',
    );
    await expect(forwardedMessage).toContainText(messageText);
    await attachScreenshot('Text-and-screenshot-forwarded');
  });
  const accountMenu = page.getByRole('button', { name: 'Account menu' });
    await expect(accountMenu).toBeVisible({ timeout: 60_000 });
    await accountMenu.click();

    const logOutOption = page.getByRole('menuitem', { name: /log out/i })
      .or(page.getByRole('button', { name: /log out/i }))
      .last();
    await expect(logOutOption).toBeVisible({ timeout: 60_000 });
    await logOutOption.click();

    const signOutAllButton = page.getByRole('button', {
      name: 'Sign out of all accounts',
      exact: true,
    });
    await expect(signOutAllButton).toBeVisible({ timeout: 60_000 });
    await signOutAllButton.click();

    await expect(page.getByPlaceholder('Email')).toBeVisible({ timeout: 60_000 });
    await attachScreenshot('sign-out-of-all-accounts');


  });
