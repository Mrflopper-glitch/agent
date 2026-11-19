# Evaluation samples

Put real voice notes here (they are git-ignored), each with a `.json` file of the same name:

```
example_ta_hospital.ogg
example_ta_hospital.json   -> {"language": "ta", "intent": "ride", "destination": "hospital", "time": "tomorrow 10:00"}
```

- `language`: ta, en, hi or te (the main language spoken, even if mixed with English)
- `intent`: ride, medical, legal, financial, other or unclear
- `destination`: in English, `""` if none was said
- `time`: `"<day> <HH:MM>"` 24-hour (`"tomorrow 10:00"`, `"today 17:30"`), `"now"`, just the day, or `""`

Aim for 10 notes per language from the actual people who will use it, including
code-mixed speech ("hospital", "taxi"), background noise and quiet voices.
WhatsApp voice notes can be exported from a chat (Share/Export) as .ogg/.opus files.
The family member writes the .json from what the elder *meant*, which they usually
know even if they can't read the script.
