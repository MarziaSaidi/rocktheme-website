# Quill & Pigeon case-study asset map

The case study is authored in `src/content/projects/records/quill-and-pigeon.project.ts`. It uses six original product screenshots and a 25-second recording. The recording is optimized as a 1600 x 1000 MP4 under `public/media/projects/quill-and-pigeon/` and has visitor-controlled playback.

| Stage      | Evidence and purpose                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| Overview   | Product recording; design and frontend scope; the review-before-save decision                             |
| Challenge  | Recipient setup with individual entry and spreadsheet import                                              |
| Review     | Editable table and explicit final import action; correction in context and the extra review-step tradeoff |
| Validation | Alert summary and duplicate-field feedback, shown once                                                    |
| File setup | Supported formats, template link, selected-file removal before upload                                     |
| Delivery   | Per-contact success and total added; audience context distinguished from feature impact                   |

The original stage IDs are retained for existing deep links. Quill sets `caseStudy.storyPlayback` to `manual`, so neither stories nor stages advance on a timer. Other projects retain their existing playback policy. The January-August dates are labelled as the internship period, not as the feature's delivery duration.

## Evidence boundaries

The existing project record establishes product design and frontend development, but does not establish ownership of backend parsing, persistence, or validation infrastructure. The copy claims interface work only. No original research, team composition, feature duration, release date, failure recovery behavior, or source code was supplied. These are not invented. The 100+ figure describes the product audience from the project brief, not measured adoption, time savings, or conversion impact of this feature.
