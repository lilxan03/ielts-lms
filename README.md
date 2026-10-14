# IELTS AI grading function

This function grades Writing responses and transcribes/grades Speaking recordings. The browser only calls the function; the model key stays in Firebase Secret Manager.

## Deploy

From this directory:

```powershell
npm install
firebase login
firebase use khanh-ielts-v2
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions:gradeIELTSSubmission,functions:streamDriveAudio
```

The frontend calls:

`https://us-central1-khanh-ielts-v2.cloudfunctions.net/gradeIELTSSubmission`

The teacher opens a Writing or Speaking submission, clicks **AI Grade Draft**, reviews the returned bands and feedback, then clicks **Save Grades & Feedback**.

Speaking recordings must be downloadable by the function. Firebase Storage download URLs are supported. The AI draft is not an official IELTS score and should be reviewed by a qualified teacher.

## Account credentials

Admin-created student, teacher, and collaborator accounts are created in Firebase Authentication through a secondary Firebase app so creating an account does not sign out the administrator. Firestore user profiles contain the Authentication UID and LMS profile data, never passwords. Student bulk import uses the same flow. An existing student profile without a UID can be provisioned from **Create Student** by entering the same username and setting a new Firebase password.

Username logins map to `<normalized-username>@khanhlms.com`. Existing Firestore-only accounts can be provisioned from **Create Student** when no Authentication account already exists for that mapped email. If it already exists, resolve the account in Firebase Console under Authentication > Users. Legacy `pass` fields are not used for login and are removed from Firestore when a teacher loads the user list. Reset passwords for these internal usernames in Firebase Console under Authentication > Users.

Firestore Rules allow an authenticated user to read only their own profile and only when its `uid` matches the Firebase Authentication UID. Do not make the `users` collection publicly readable.

### Deploy access controls

The checkout reads public course names and lesson fees from `course_catalog`; a staff LMS session synchronizes this limited catalog from the private `classes` collection. Packages are loaded from the public-readable `packages` collection. The `account_access/{uid}` document is the only source of truth for staff role and student access. Students can create only an unpaid student access record for themselves; only the administrator account below can grant or revoke paid access. New usernames are normalized to lowercase and must contain 1-40 ASCII letters, numbers, underscores, or hyphens.

The Firestore rules use the administrator email already configured in the application (`lyquockhanh03@gmail.com`) and the Firebase project ID in the web app configuration (`khanh-ielts-v2`). Review both values before deployment. From this directory, deploy with:

```powershell
firebase login
firebase deploy --only firestore:rules
```

Existing accounts without an Authentication UID/access record remain locked until linked or explicitly approved by the administrator. Admin-created student accounts receive paid access immediately; public sign-ups remain locked on the payment screen until the administrator approves their payment.

## IELTS LaTeX-style question import

In the teacher test builder, choose **LaTeX Import** to write source with a live preview. Compiling converts source into the LMS's existing part/question structures. A supplied passage or task title replaces the current part title/content after confirmation. Macro types are checked against the selected Reading, Listening, Writing, or Speaking skill.

The importer includes a skill-specific template picker above the source editor. Choose a question type and select **Insert template** to add a valid starter at the cursor; replace the example prompt, options, answers, URLs, and map coordinates with your content. The template list updates for the selected skill. Question blocks, their live-preview numbering, and imported order follow the order in the source; inline passage gaps count as questions at the point where the passage appears.

### Reading and Listening

```text
\audio{https://example.com/listening.mp3}
\passage{The Evolution of Language}{
The system relies on \gap{photosynthesis}.
Both \gap[colour]{color} and \gap[time=01:23]{sound} are accepted.
}

\mcq{What is the main advantage?}{
  \choice{It is cheaper.}
  \correct{It is faster.}
  \choice{It is easier to maintain.}
}
\tfng{The study was conducted in 2026.}{NOT GIVEN}[The passage does not state the date.]
\matchingheadings{Choose the correct heading.}{
  \item{Paragraph A}{ii. The first experiment}
  \item{Paragraph B}{i. How cities grow}
}{
  \option{i. How cities grow}
  \option{ii. The first experiment}
  \option{iii. A later discovery}
}
\matchinginfo{Match each fact to its source.}{
  \item{The first trial took place in June.}{Report A}
  \item{The method was revised later.}{Report B}
}{
  \option{Report A}
  \option{Report B}
}
\mapgrid[image=https://example.com/map.png]{Choose the correct map location.}{
  \item{Quilt Shop}{B}
  \item{Handicrafts Museum}{D}
}{
  \option{A}
  \option{B}
  \option{C}
  \option{D}
}
\maphotspots[image=https://example.com/map.png]{Label each place on the map.}{
  \hotspot{25}{40}{Cookery room}
  \hotspot{72}{65}{Games room}
}{
  \option{Cookery room}
  \option{Games room}
}
```

Supported Reading types are multiple choice, gap fill, drag/drop, TFNG, YNNG, matching headings, matching information, and both map-labelling types. Listening supports multiple choice, gap fill, drag/drop, and both map-labelling types. `\drop` creates a drag/drop blank; do not mix `\gap` and `\drop` in one passage. Gap alternatives are `|`-separated (for example `\gap[color|colour]{color}`), and timestamp options accept seconds, `MM:SS`, or `HH:MM:SS`. Timed gaps highlight during Listening playback. MCQ needs at least two options and exactly one `\correct`. Matching/map item answers must refer to a listed option. Map images require an HTTP(S) URL and hotspot coordinates are percentages from 0 to 100.

### Writing

```text
\writingtask[task=1]{Writing Task 1}{Summarise the information by selecting and reporting the main features.}
```

`task=1` or `task=2` is stored in the part's `writingTask` field. The prompt is compiled as a native essay task.

### Speaking

```text
\speaking{A memorable journey}{Describe a journey that you remember well.}{
  \question{Where did you go?}
  \question{Who did you travel with?}
}
\notes{Make brief notes before you speak.}
```

The Speaking macro creates an audio-recording response, stores follow-up questions on the part, and `\notes` adds a native notes/text response. `\audio` assigns a Listening audio URL to the current part.
