/** Archived-content UI fixture. This module is never imported by the production app. */
import { campaignChapters } from "../../src/campaign";
import { jobs } from "../../src/game";
for (let chapter = 1; chapter <= 6; chapter++) campaignChapters[chapter] = {
  title: "旧版の検証", jobIds: jobs.filter(j => !j.id.startsWith("ch1-")).map(j => j.id),
  people: ["vernet", "claire"], events: [],
};
