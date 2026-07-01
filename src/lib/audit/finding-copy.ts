/**
 * Plain-English, client-facing copy for every finding code.
 *
 * This is the copy shown to the CLIENT in the audit report -- not the
 * internal fix-plan. Each entry describes the PROBLEM in plain language
 * (no jargon, roughly a 5-year-old reading level) and the business IMPACT
 * in one short sentence. No fixes, recommendations, or "how to" language
 * belongs here -- that lives in the fix-plan (a separate module).
 *
 * Coverage of every code in `FINDING_CODES` (src/lib/audit/finding-codes.ts)
 * is enforced by src/lib/audit/__tests__/copy-coverage.test.ts.
 */
import type { KnownCode } from "./finding-codes";

export interface FindingCopyEntry {
  plain: string;
  impact: string;
}

const COPY: Record<KnownCode, FindingCopyEntry> = {
  // ---------------------------------------------------------------------
  // seo.* -- SEO Fundamentals
  // ---------------------------------------------------------------------
  "seo.title.missing": {
    plain: "Most pages don't have a name at the top that shows up in Google search results.",
    impact: "Google and AI tools don't know what the pages are about, so fewer people find you.",
  },
  "seo.title.duplicate": {
    plain: "Most pages share the exact same name at the top instead of having their own.",
    impact: "Google can't tell your pages apart, so it may only show one of them in search.",
  },
  "seo.pages.none": {
    plain: "The site couldn't be read at all, so nothing on it could be checked.",
    impact: "If the site can't be read by a scanning tool, it likely can't be read by Google either.",
  },
  "seo.title.coverage.partial": {
    plain: "Some pages don't have a name at the top of the page.",
    impact: "Those pages are harder for Google and AI tools to understand and show in search.",
  },
  "seo.title.duplicate.partial": {
    plain: "A few pages share the same name at the top instead of having their own.",
    impact: "Search engines have a harder time telling those pages apart in results.",
  },
  "seo.meta.coverage.partial": {
    plain: "Some pages are missing the short summary that shows up under the link in Google.",
    impact: "Google fills in a random snippet instead, which is less likely to make people click.",
  },
  "seo.meta.coverage.missing": {
    plain: "Most pages are missing the short summary that shows up under the link in Google.",
    impact: "Google writes its own snippet for these pages, which rarely sells the click.",
  },
  "seo.meta.duplicate.partial": {
    plain: "A few pages use the same short search summary as each other.",
    impact: "Those pages look identical in search results, so people can't tell which to click.",
  },
  "seo.meta.duplicate": {
    plain: "Most pages use the same short search summary as each other.",
    impact: "The pages compete with each other in search results instead of standing out.",
  },
  "seo.h1.issues.partial": {
    plain: "Some pages are missing the big main heading, or have more than one.",
    impact: "It's less clear to Google and visitors what those pages are actually about.",
  },
  "seo.h1.issues.severe": {
    plain: "Most pages are missing the big main heading, or have more than one.",
    impact: "Google and visitors struggle to tell what the page is about, hurting search rankings.",
  },
  "seo.heading.hierarchy.skipped": {
    plain: "Some pages jump from a big heading straight to a small one, skipping sizes in between.",
    impact: "This makes the page structure confusing for screen readers, Google, and AI tools.",
  },
  "seo.image.alt.partial": {
    plain: "Some pictures are missing the written description that describes what they show.",
    impact: "Google and AI tools can't tell what those pictures show, so fewer show up in image search.",
  },
  "seo.image.alt.missing": {
    plain: "Most pictures are missing the written description that describes what they show.",
    impact: "Google and AI tools can't index these images, and blind visitors can't understand them either.",
  },
  "seo.sitemap.missing": {
    plain: "There's no map file that lists every page on the site for Google to follow.",
    impact: "Google may miss pages entirely, so they never show up in search results.",
  },
  "seo.robots.missing": {
    plain: "There's no robots.txt file telling search engines and AI crawlers how to crawl the site.",
    impact: "Crawlers fall back to guessing, and the site misses an easy way to point them straight at its sitemap.",
  },
  "seo.canonical.missing": {
    plain: "Pages don't tell Google which version of the page is the \"real\" one.",
    impact: "Google may get confused by duplicate-looking pages and rank the wrong one, or none at all.",
  },
  "seo.structureddata.missing": {
    plain: "Pages don't include the hidden extra information that helps Google understand the business.",
    impact: "The site misses out on rich search results like star ratings, prices, or FAQs in Google.",
  },
  "seo.opengraph.missing": {
    plain: "The homepage is missing the tags that control how it looks when shared on Facebook or LinkedIn.",
    impact: "Shared links look plain and unprofessional, which lowers clicks from social media.",
  },
  "seo.orphan.pages": {
    plain: "Some pages aren't linked to from anywhere else on the site.",
    impact: "Google and visitors have trouble finding these pages, so they rarely get seen.",
  },
  "seo.title.length": {
    plain: "Many page names at the top are too short or too long for Google to show properly.",
    impact: "Google cuts off or rewrites these titles in search results, making them less compelling.",
  },

  // ---------------------------------------------------------------------
  // perf.* -- Performance & Speed
  // ---------------------------------------------------------------------
  "perf.psi.unavailable": {
    plain: "The site's speed couldn't be measured at all.",
    impact: "Unmeasured speed is treated as a red flag, since visitors and Google both care how fast a site loads.",
  },
  "perf.lighthouse.needsimprovement": {
    plain: "The site's overall speed score is okay, but not great.",
    impact: "Visitors on slower connections may get impatient and leave before the page finishes loading.",
  },
  "perf.lighthouse.poor": {
    plain: "The site's overall speed score is poor.",
    impact: "Slow-loading pages push visitors away and can hurt how well the site ranks in Google.",
  },
  "perf.lighthouse.verypoor": {
    plain: "The site's overall speed score is very poor.",
    impact: "Most visitors will get frustrated and leave before the page even finishes loading.",
  },
  "perf.lcp.slow": {
    plain: "The biggest thing on the page (usually the main image or headline) takes a while to show up.",
    impact: "Visitors stare at a mostly blank page for a few seconds before anything looks ready.",
  },
  "perf.lcp.verypoor": {
    plain: "The biggest thing on the page takes way too long to show up.",
    impact: "Visitors likely leave before the page even looks like it's loaded.",
  },
  "perf.fcp.slow": {
    plain: "It takes a while before anything at all appears on the screen.",
    impact: "Visitors see a blank white screen and may assume the site is broken.",
  },
  "perf.fcp.verypoor": {
    plain: "It takes far too long before anything at all appears on the screen.",
    impact: "Visitors are very likely to leave before they see any content.",
  },
  "perf.cls.high": {
    plain: "Things on the page move around while it's loading, so buttons and text jump position.",
    impact: "Visitors can accidentally tap the wrong thing, which is frustrating and erodes trust.",
  },
  "perf.cls.veryhigh": {
    plain: "Things on the page shift around a lot while it's loading.",
    impact: "Visitors frequently misclick buttons or links, which feels broken and unprofessional.",
  },
  "perf.tbt.high": {
    plain: "The page looks ready but doesn't actually respond to clicks and taps for a bit.",
    impact: "Visitors tap something and nothing happens, which feels like the site is frozen.",
  },
  "perf.tbt.veryhigh": {
    plain: "The page looks ready but stays unresponsive to clicks and taps for a long stretch.",
    impact: "Visitors repeatedly tap things that don't respond, and many give up and leave.",
  },
  "perf.speedindex.slow": {
    plain: "It takes a while for the visible part of the page to fully fill in.",
    impact: "The site feels sluggish even if it eventually finishes loading.",
  },
  "perf.speedindex.veryslow": {
    plain: "It takes a long time for the visible part of the page to fully fill in.",
    impact: "The site feels very slow, which drives visitors to competitors instead.",
  },
  "perf.page.below50": {
    plain: "At least one page scores especially poorly on speed compared to the rest of the site.",
    impact: "Visitors who land on that specific page get a noticeably worse experience.",
  },
  "perf.pageweight.high": {
    plain: "The homepage sends more data to the visitor's device than it needs to.",
    impact: "The page loads more slowly, especially for visitors on phones or slower internet.",
  },
  "perf.variance.high": {
    plain: "Some pages load much faster than others on the same site.",
    impact: "Visitors get an inconsistent experience depending on which page they land on.",
  },

  // ---------------------------------------------------------------------
  // visual.* -- Visual Design & Branding
  // ---------------------------------------------------------------------
  "visual.pages.none": {
    plain: "The site couldn't be read at all, so its look and design couldn't be checked.",
    impact: "If a scanning tool can't read the site, visitors and Google likely struggle too.",
  },
  "visual.viewport.missing": {
    plain: "The site doesn't tell phones and tablets how to resize the page to fit their screen.",
    impact: "The site may look zoomed-in, cut off, or hard to use on a phone.",
  },
  "visual.favicon.missing": {
    plain: "There's no small icon set up to show in the browser tab.",
    impact: "The browser shows a generic blank icon instead, making the site look unfinished.",
  },
  "visual.fonts.missing": {
    plain: "The site uses the plain default text style built into every browser instead of its own custom look.",
    impact: "The brand doesn't stand out visually and can look generic or unpolished.",
  },
  "visual.images.homepage.none": {
    plain: "The homepage has no pictures on it at all.",
    impact: "A page with no visuals feels bare and gives visitors nothing to connect with emotionally.",
  },
  "visual.images.unique.low": {
    plain: "The whole site only uses a handful of different pictures.",
    impact: "The site feels thin and repetitive, which can make the business look small or inactive.",
  },
  "visual.images.responsive.missing": {
    plain: "Pictures are set up as one fixed size instead of resizing smartly for different screens.",
    impact: "Images may look stretched, cut off, or load slowly on phones and tablets.",
  },
  "visual.h1.partial": {
    plain: "Some pages are missing the big main heading that visitors see first.",
    impact: "Visitors on those pages have a less clear sense of what the page is about.",
  },
  "visual.h1.missing": {
    plain: "Most pages are missing the big main heading that visitors see first.",
    impact: "Visitors land on pages that don't clearly say what they're looking at.",
  },
  "visual.alt.partial": {
    plain: "Some pictures are missing the written description that describes what they show.",
    impact: "Visitors using screen readers, and Google, miss out on understanding those images.",
  },
  "visual.alt.missing": {
    plain: "Most pictures are missing the written description that describes what they show.",
    impact: "Visitors who rely on screen readers can't tell what's in most of the images on the site.",
  },
  "visual.ogimage.missing": {
    plain: "The homepage doesn't have a preview picture set up for when it's shared on social media.",
    impact: "Shared links show no image, which makes them far less likely to get clicked.",
  },
  "visual.imageformats.legacy": {
    plain: "Pictures are saved in older file formats instead of newer, smaller ones.",
    impact: "Pages take longer to load than they need to because the images are bigger than necessary.",
  },
  "visual.brokenimages.minor": {
    plain: "A couple of pictures on the site are broken and don't show up.",
    impact: "Those spots look unfinished or unprofessional to anyone who notices.",
  },
  "visual.brokenimages.severe": {
    plain: "Several pictures on the site are broken and don't show up.",
    impact: "The site looks noticeably unfinished, which can make visitors question how well it's maintained.",
  },

  // ---------------------------------------------------------------------
  // usability.* -- Usability & Navigation
  // ---------------------------------------------------------------------
  "usability.pages.none": {
    plain: "The site couldn't be read at all, so how easy it is to use couldn't be checked.",
    impact: "If a scanning tool can't navigate the site, real visitors likely struggle too.",
  },
  "usability.nav.semantic.missing": {
    plain: "The site has a menu of links, but it's not built the standard, cleanly-tagged way.",
    impact: "Screen readers and some tools have a harder time recognizing it as the main menu.",
  },
  "usability.nav.missing": {
    plain: "The homepage doesn't have a clear menu of links to the rest of the site.",
    impact: "Visitors don't know where else to go, so they may just leave.",
  },
  "usability.nav.coverage.partial": {
    plain: "Some pages don't show the same menu that the rest of the site has.",
    impact: "Visitors who land on those pages can get stuck without an easy way to explore further.",
  },
  "usability.nav.coverage.missing": {
    plain: "Most pages don't show the same menu that the rest of the site has.",
    impact: "The site feels inconsistent, and visitors frequently get stuck with nowhere to click.",
  },
  "usability.clickdepth.partial": {
    plain: "Every page can be reached, but some take three clicks from the homepage instead of two.",
    impact: "Visitors have to click around a bit more than they should to find what they need.",
  },
  "usability.clickdepth.severe": {
    plain: "Some pages can't be reached within a few clicks starting from the homepage.",
    impact: "Visitors may give up looking for information that's technically on the site but hard to find.",
  },
  "usability.brokenlinks.minor": {
    plain: "A couple of pages return an error instead of loading properly.",
    impact: "Visitors who land on those pages hit a dead end and may lose trust in the site.",
  },
  "usability.brokenlinks.severe": {
    plain: "Several pages return an error instead of loading properly.",
    impact: "Visitors frequently hit dead ends, which damages trust and drives them away.",
  },
  "usability.internallinks.moderate": {
    plain: "Pages don't link to each other very often.",
    impact: "Visitors have fewer natural paths to discover other parts of the site.",
  },
  "usability.internallinks.weak": {
    plain: "Pages rarely link to each other at all.",
    impact: "Visitors land on a page and have little reason or way to explore the rest of the site.",
  },
  "usability.skipnav.missing": {
    plain: "There's no shortcut for keyboard users to jump past the menu straight to the content.",
    impact: "Visitors who navigate by keyboard have to tab through the whole menu on every single page.",
  },
  "usability.a11y.partial": {
    plain: "A few things on the site are hard for people with disabilities to use.",
    impact: "Some visitors with disabilities will have a harder time using the site than they should.",
  },
  "usability.a11y.severe": {
    plain: "Several things on the site are hard or impossible for people with disabilities to use.",
    impact: "Visitors with disabilities may be unable to use the site at all, and it also creates legal risk.",
  },
  "usability.titles.partial": {
    plain: "Some pages have a name at the top that's too short or generic to describe what's on the page.",
    impact: "Visitors scanning browser tabs or search results can't easily tell those pages apart.",
  },
  "usability.titles.poor": {
    plain: "Most pages have a name at the top that's too short or generic to describe what's on the page.",
    impact: "Visitors and search engines struggle to tell what most pages are actually about.",
  },
  "usability.taptargets.issues": {
    plain: "Some buttons and links are too small or too close together to tap easily on a phone.",
    impact: "Mobile visitors may tap the wrong thing or struggle to interact with the site at all.",
  },
  "usability.content.jsdependent": {
    plain: "The homepage shows very little readable text without extra behind-the-scenes loading.",
    impact: "Some visitors, and some search engines, may see a mostly empty page.",
  },

  // ---------------------------------------------------------------------
  // aeo.* -- AI-search / answer-engine optimization
  // ---------------------------------------------------------------------
  "aeo.schema.absent": {
    plain: "The homepage doesn't include the hidden extra information that tells computers what the business is.",
    impact: "AI tools like ChatGPT and Google's AI answers have to guess what the business does instead of knowing for sure.",
  },
  "aeo.schema.coverage.low": {
    plain: "Only about half or fewer of the pages include that hidden extra information for computers.",
    impact: "AI tools understand less than half the site clearly, so they're less likely to recommend it.",
  },
  "aeo.entity.schema.missing": {
    plain: "There's no hidden data confirming the business's name, address, or phone number to computers.",
    impact: "AI tools can't confidently confirm who this business is, so they're less likely to mention it.",
  },
  "aeo.faq.absent": {
    plain: "The site has no FAQ section or question-and-answer content.",
    impact: "AI tools pull answers from FAQ-style content constantly, and this site has none to pull from.",
  },
  "aeo.headings.notquestions": {
    plain: "None of the section headings are written as questions.",
    impact: "AI tools match people's spoken questions to headings phrased as questions, so this content gets skipped over.",
  },
  "aeo.content.notanswerfirst": {
    plain: "The text under headings doesn't get straight to the point with a direct answer.",
    impact: "AI tools prefer to quote a short, direct answer right after a heading, so this content is less likely to get quoted.",
  },
  "aeo.llms.absent": {
    plain: "There's no simple summary file that gives AI tools a quick overview of the site.",
    impact: "AI tools have to work harder to understand the site, making it less likely to be picked up accurately.",
  },
  "aeo.entity.sameas.missing": {
    plain: "The hidden business information doesn't link out to the business's social media or other profiles.",
    impact: "AI tools have a harder time confirming this is the same business people find elsewhere online.",
  },
  "aeo.nap.inconsistent": {
    plain: "The business's name, address, or phone number don't match across different pages.",
    impact: "AI tools get confused by the mismatch and become less confident recommending the business.",
  },
  "aeo.freshness.absent": {
    plain: "There's no visible sign of when content was written or last updated.",
    impact: "AI tools favor content that looks current, and this site gives no clue that it is.",
  },
  "aeo.aicrawlers.blocked": {
    plain: "The site is set up to block AI tools from reading it.",
    impact: "AI assistants and AI search results simply can't see this site at all, so it never gets mentioned.",
  },
  "aeo.headings.structure": {
    plain: "The homepage doesn't have exactly one clear main heading.",
    impact: "AI tools have a harder time figuring out the single most important topic of the page.",
  },
  "aeo.summary.absent": {
    plain: "The homepage is missing the short summary text that computers use to describe the page.",
    impact: "AI tools have to guess at a summary instead of using one the business wrote itself.",
  },

  // ---------------------------------------------------------------------
  // cta.* -- Calls to Action
  // ---------------------------------------------------------------------
  "cta.pages.none": {
    plain: "The site couldn't be read at all, so its calls to action couldn't be checked.",
    impact: "If a scanning tool can't find a way to take action on the site, visitors likely can't either.",
  },
  "cta.homepage.missing": {
    plain: "The homepage doesn't have a clear button or link telling visitors what to do next.",
    impact: "Visitors land on the homepage with no obvious next step, so many just leave.",
  },
  "cta.keywords.none": {
    plain: "The site never uses inviting words like \"contact,\" \"schedule,\" or \"get started\" anywhere.",
    impact: "Visitors aren't prompted to take any action, so most just browse and leave.",
  },
  "cta.keywords.few": {
    plain: "The site only uses a couple of inviting action words like \"contact\" or \"get started.\"",
    impact: "Visitors don't get many prompts to take action, so fewer of them do.",
  },
  "cta.form.pagelinked": {
    plain: "A contact or form page is linked, but the form itself couldn't be directly confirmed.",
    impact: "It's unclear whether visitors can actually submit information without more digging.",
  },
  "cta.form.missing": {
    plain: "There's no contact form anywhere on the site.",
    impact: "Visitors who'd rather type a message than call have no way to reach the business.",
  },
  "cta.phone.nothomepage": {
    plain: "A phone number exists somewhere on the site, but not on the homepage.",
    impact: "Visitors who want to call right away have to hunt for the number instead.",
  },
  "cta.phone.missing": {
    plain: "There's no phone number anywhere on the site.",
    impact: "Visitors who prefer to call simply have no way to do it.",
  },
  "cta.email.nothomepage": {
    plain: "An email address exists somewhere on the site, but not on the homepage.",
    impact: "Visitors who want to email right away have to search for the address instead.",
  },
  "cta.email.missing": {
    plain: "There's no email address anywhere on the site.",
    impact: "Visitors who prefer email have no way to reach the business.",
  },
  "cta.paths.partial": {
    plain: "The site is missing one of the main ways to get in touch (form, phone, or email).",
    impact: "Some visitors won't have their preferred way to reach out, so they leave instead.",
  },
  "cta.paths.single": {
    plain: "The site only offers one single way to get in touch.",
    impact: "Visitors who don't like that one option have no alternative, so they leave without contacting the business.",
  },
  "cta.paths.none": {
    plain: "There's no form, phone number, or email address anywhere on the site.",
    impact: "Visitors have no way at all to contact the business.",
  },
  "cta.coverage.partial": {
    plain: "Only some pages have a clear call to action on them.",
    impact: "Visitors who land on the other pages don't get prompted to take the next step.",
  },
  "cta.coverage.missing": {
    plain: "Most pages have no clear call to action on them.",
    impact: "Most pages are dead ends -- visitors read and leave without being prompted to act.",
  },
  "cta.contactpage.missing": {
    plain: "There's no dedicated page for getting in touch with the business.",
    impact: "Visitors looking specifically to make contact have no obvious place to go.",
  },
  "cta.language.weak": {
    plain: "Buttons and links use flat, generic wording like \"click here\" or \"submit\" instead of inviting language.",
    impact: "Weak wording makes visitors less motivated to click through and take action.",
  },
  // ---------------------------------------------------------------------
  // trust.* -- Trust & Credibility
  // ---------------------------------------------------------------------
  "trust.pages.none": {
    plain: "The site couldn't be read at all, so trust signals couldn't be checked.",
    impact: "If a scanning tool can't confirm the site is trustworthy, visitors may have the same doubts.",
  },
  "trust.https.missing": {
    plain: "The site isn't using a secure, locked connection.",
    impact: "Browsers show visitors a \"Not Secure\" warning, which scares many of them away immediately.",
  },
  "trust.privacypolicy.missing": {
    plain: "There's no privacy policy page anywhere on the site.",
    impact: "Visitors have no way to see how their information is handled, which can make them hesitant to share it.",
  },
  "trust.terms.missing": {
    plain: "There's no terms of service page anywhere on the site.",
    impact: "There's nothing spelling out the rules for using the site or its services.",
  },
  "trust.contactpage.missing": {
    plain: "There's no dedicated page for getting in touch with the business.",
    impact: "Visitors looking to reach out have no clear, obvious place to go, which reduces trust.",
  },
  "trust.address.missing": {
    plain: "There's no physical address listed anywhere on the site.",
    impact: "Visitors have no way to confirm this is a real, local business, which lowers trust.",
  },
  "trust.social.none": {
    plain: "There are no links to any social media accounts anywhere on the site.",
    impact: "Visitors have no way to see the business is active and real on social media.",
  },
  "trust.social.partial": {
    plain: "Only a couple of social media accounts are linked from the site.",
    impact: "Visitors get a limited view of the business's presence and activity elsewhere online.",
  },
  "trust.testimonials.missing": {
    plain: "There are no customer reviews or testimonials anywhere on the site.",
    impact: "Visitors have no proof that other real people were happy with this business, which is a key reason people decide to buy.",
  },
  "trust.schema.missing": {
    plain: "There's no hidden data telling Google this is a real, verified business.",
    impact: "The business misses out on showing up in Google's business info panel next to search results.",
  },
  "trust.aboutpage.missing": {
    plain: "There's no About page introducing the people behind the business.",
    impact: "Visitors can't learn who they'd actually be working with, which makes the business feel less personal and trustworthy.",
  },

  // ---------------------------------------------------------------------
  // content.* -- Content Quality
  // ---------------------------------------------------------------------
  "content.pages.none": {
    plain: "The site couldn't be read at all, so its content couldn't be checked.",
    impact: "If a scanning tool can't read the content, Google likely has the same trouble.",
  },
  "content.homepage.words.moderate": {
    plain: "The homepage has a decent amount of text, but not quite enough.",
    impact: "There's a bit less substance for Google and visitors to work with than there should be.",
  },
  "content.homepage.words.thin": {
    plain: "The homepage has very little written text on it.",
    impact: "Thin content gives Google little to rank and gives visitors little reason to stay.",
  },
  "content.homepage.words.severelythin": {
    plain: "The homepage has almost no written text on it at all.",
    impact: "The homepage barely explains anything, so both Google and visitors have very little to go on.",
  },
  "content.avgwords.below": {
    plain: "Across the whole site, the typical page has less writing on it than it should.",
    impact: "Thinner pages give Google and visitors less reason to consider them valuable.",
  },
  "content.avgwords.thin": {
    plain: "Across the whole site, most pages have very little writing on them.",
    impact: "The site overall looks thin to Google and doesn't give visitors much to read or trust.",
  },
  "content.thinpages.one": {
    plain: "One page on the site has barely any written content.",
    impact: "That page gives visitors and Google very little reason to value it.",
  },
  "content.thinpages.many": {
    plain: "Several pages on the site have barely any written content.",
    impact: "Those pages give visitors and Google very little reason to value them.",
  },
  "content.titles.duplicate": {
    plain: "Several pages share the exact same name at the top instead of having their own.",
    impact: "Search engines and visitors can't easily tell those pages apart.",
  },
  "content.emptypages.one": {
    plain: "One page on the site is essentially blank.",
    impact: "Visitors who land there find almost nothing, which looks unfinished.",
  },
  "content.emptypages.many": {
    plain: "Several pages on the site are essentially blank.",
    impact: "Visitors who land on those pages find almost nothing, which looks unfinished and hurts trust.",
  },
  "content.brokenimages": {
    plain: "Several pictures across the site are broken and don't show up.",
    impact: "The site looks unfinished or poorly maintained to anyone who notices.",
  },
  "content.blog.missing": {
    plain: "There's no blog, news, or articles section anywhere on the site.",
    impact: "The business has no ongoing content to attract new visitors through search or share on social media.",
  },
  "content.freshness.missing": {
    plain: "Nothing on the site mentions the current or recent year.",
    impact: "The site can look outdated or abandoned to visitors, even if it isn't.",
  },
  "content.ratio.thin": {
    plain: "Most pages on the site don't have much written content on them.",
    impact: "The site overall feels thin, giving Google and visitors less reason to trust it.",
  },
  "content.meta.thin": {
    plain: "Most pages are missing a solid, descriptive summary for search results.",
    impact: "Google shows a weaker, auto-generated snippet instead, which is less likely to earn a click.",
  },
  "content.depth.limited": {
    plain: "The site only has a small handful of pages in total.",
    impact: "There's less for Google to index and less for visitors to explore, which limits how the business shows up in search.",
  },

  // ---------------------------------------------------------------------
  // conversion.* -- Conversion Architecture
  // ---------------------------------------------------------------------
  "conversion.pages.none": {
    plain: "The site couldn't be read at all, so how well it turns visitors into leads couldn't be checked.",
    impact: "If a scanning tool can't find a way to convert on the site, visitors likely can't either.",
  },
  "conversion.forms.none": {
    plain: "There's no form anywhere on the site for visitors to fill out.",
    impact: "Visitors have no simple way to submit their information, so many leave without becoming a lead.",
  },
  "conversion.form.fields.moderate": {
    plain: "The form asks for a moderate number of pieces of information.",
    impact: "Every extra field on a form causes more people to give up partway through.",
  },
  "conversion.form.fields.excessive": {
    plain: "The form asks for a lot of pieces of information before it can be submitted.",
    impact: "Long forms scare people off, so far fewer visitors finish and submit them.",
  },
  "conversion.paths.partial": {
    plain: "The site is missing one of the main ways to convert a visitor into a lead (form, phone, or email).",
    impact: "Some visitors won't have their preferred way to reach out, so they leave instead of converting.",
  },
  "conversion.paths.single": {
    plain: "The site only offers one single way to convert a visitor into a lead.",
    impact: "Visitors who don't like that one option have no alternative, so fewer of them convert.",
  },
  "conversion.paths.none": {
    plain: "There's no form, phone number, or email address anywhere on the site.",
    impact: "There's no way for visitors to become leads at all.",
  },
  "conversion.socialproof.notcolocated": {
    plain: "Reviews and testimonials exist, but they're not shown near the buttons that ask people to take action.",
    impact: "Visitors don't see proof that others trust the business right when they're deciding whether to act.",
  },
  "conversion.socialproof.missing": {
    plain: "There are no reviews or testimonials shown anywhere near the calls to action.",
    impact: "Visitors have nothing reassuring them right when they're deciding whether to reach out.",
  },
  "conversion.h1.tooshort": {
    plain: "The homepage's big main heading is only a few words -- too short to explain what the business offers.",
    impact: "Visitors don't immediately understand what the business does or why they should care.",
  },
  "conversion.h1.missing": {
    plain: "The homepage doesn't have a big main heading at all.",
    impact: "Visitors land on the homepage with no clear statement of what the business offers.",
  },
  "conversion.abovefold.partial": {
    plain: "The very top of the homepage is missing one of the key pieces -- a heading, supporting text, or a call to action.",
    impact: "Visitors don't get the full picture right away and may leave before scrolling further.",
  },
  "conversion.abovefold.missing": {
    plain: "The very top of the homepage is missing most of the key pieces -- heading, supporting text, and a call to action.",
    impact: "Visitors see little to nothing convincing in the first few seconds, so many leave immediately.",
  },
  "conversion.leadmagnet.missing": {
    plain: "There's no free guide, discount, or special offer anywhere on the site.",
    impact: "Visitors who aren't ready to buy yet have no lower-commitment reason to give the business their information.",
  },
  "conversion.pricing.missing": {
    plain: "There's no pricing page or way to request a quote anywhere on the site.",
    impact: "Visitors who want to know the cost may leave to find that information on a competitor's site instead.",
  },
  "conversion.depth.limited": {
    plain: "The site only has a small handful of pages in total.",
    impact: "There's not enough content to guide different types of visitors toward becoming a lead.",
  },
};

/**
 * Look up the plain-English, client-facing copy for a finding code.
 *
 * Throws if the code has no entry -- coverage gaps must be caught by the
 * copy-coverage test, not silently papered over by a runtime fallback.
 */
export function findingCopy(code: string): FindingCopyEntry {
  const entry = (COPY as Record<string, FindingCopyEntry>)[code];
  if (!entry) {
    throw new Error(`No finding-copy entry for code "${code}". Add one to src/lib/audit/finding-copy.ts.`);
  }
  return entry;
}
