"""Every phrase the elder hears, in every supported language.

STRINGS[key][language_code]. A test checks that every key has every language
listed in languages.py, so a missing translation fails the test suite.

Lines marked "needs native-speaker review" were written by a non-native
author. Have a fluent speaker of each language check them before real use.
Family-facing messages are English-only and live in flow.py.
"""

STRINGS = {
    # Prefixed to the confirmation question so the bot always identifies
    # itself as an assistant, never as a person.
    "assistant_intro": {
        "en": "This is your digital assistant.",
        "ta": "நான் உங்கள் டிஜிட்டல் உதவியாளர்.",  # needs native-speaker review
        "hi": "मैं आपका डिजिटल सहायक हूँ।",  # needs native-speaker review
        "te": "నేను మీ డిజిటల్ సహాయకుడిని.",  # needs native-speaker review
    },
    # Fallback confirmation, used only when the AI's own question is missing
    # or unusable. {destination} and {time} are filled with English words.
    "confirm_ride_with_time": {
        "en": "You want a car to {destination}, {time}. Is that right? Please say yes or no.",
        "ta": "{time} {destination} போக கார் வேண்டுமா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.",  # needs native-speaker review
        "hi": "आपको {time} {destination} जाने के लिए गाड़ी चाहिए। क्या यह सही है? कृपया हाँ या ना बोलिए।",  # needs native-speaker review
        "te": "మీకు {time} {destination} కి వెళ్ళడానికి కారు కావాలి. ఇది సరైనదేనా? దయచేసి అవును లేదా కాదు అని చెప్పండి.",  # needs native-speaker review
    },
    "confirm_ride_no_time": {
        "en": "You want a car to {destination}. Is that right? Please say yes or no.",
        "ta": "{destination} போக கார் வேண்டுமா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.",  # needs native-speaker review
        "hi": "आपको {destination} जाने के लिए गाड़ी चाहिए। क्या यह सही है? कृपया हाँ या ना बोलिए।",  # needs native-speaker review
        "te": "మీకు {destination} కి వెళ్ళడానికి కారు కావాలి. ఇది సరైనదేనా? దయచేసి అవును లేదా కాదు అని చెప్పండి.",  # needs native-speaker review
    },
    "ask_repeat": {
        "en": "Sorry, I could not understand. Please send your voice message again, slowly.",
        "ta": "மன்னிக்கவும், எனக்கு புரியவில்லை. தயவுசெய்து உங்கள் குரல் செய்தியை மெதுவாக மீண்டும் அனுப்புங்கள்.",  # needs native-speaker review
        "hi": "माफ़ कीजिए, मैं समझ नहीं पाया। कृपया अपना वॉइस मैसेज धीरे-धीरे दोबारा भेजिए।",  # needs native-speaker review
        "te": "క్షమించండి, నాకు అర్థం కాలేదు. దయచేసి మీ వాయిస్ మెసేజ్‌ని నెమ్మదిగా మళ్ళీ పంపండి.",  # needs native-speaker review
    },
    "ask_destination": {
        "en": "Where do you want to go? Please send a voice message again and say the place.",
        "ta": "நீங்கள் எங்கே போக வேண்டும்? தயவுசெய்து இடத்தின் பெயரைச் சொல்லி மீண்டும் குரல் செய்தி அனுப்புங்கள்.",  # needs native-speaker review
        "hi": "आपको कहाँ जाना है? कृपया जगह का नाम बोलकर दोबारा वॉइस मैसेज भेजिए।",  # needs native-speaker review
        "te": "మీరు ఎక్కడికి వెళ్ళాలి? దయచేసి ఆ స్థలం పేరు చెప్పి మళ్ళీ వాయిస్ మెసేజ్ పంపండి.",  # needs native-speaker review
    },
    "yes_no_unclear": {
        "en": "Sorry, I did not understand. Please say yes or no.",
        "ta": "மன்னிக்கவும், புரியவில்லை. ஆம் அல்லது இல்லை என்று மட்டும் சொல்லுங்கள்.",  # needs native-speaker review
        "hi": "माफ़ कीजिए, समझ नहीं आया। कृपया सिर्फ़ हाँ या ना बोलिए।",  # needs native-speaker review
        "te": "క్షమించండి, అర్థం కాలేదు. దయచేసి అవును లేదా కాదు అని మాత్రమే చెప్పండి.",  # needs native-speaker review
    },
    "sent_to_family": {
        "en": "Thank you. I have told your family. They will book the car and I will let you know.",
        "ta": "நன்றி. உங்கள் குடும்பத்தினரிடம் சொல்லிவிட்டேன். அவர்கள் காரை பதிவு செய்வார்கள், நான் உங்களுக்குத் தெரிவிக்கிறேன்.",  # needs native-speaker review
        "hi": "धन्यवाद। मैंने आपके परिवार को बता दिया है। वे गाड़ी बुक करेंगे और मैं आपको बता दूँगा।",  # needs native-speaker review
        "te": "ధన్యవాదాలు. మీ కుటుంబ సభ్యులకు చెప్పాను. వారు కారు బుక్ చేస్తారు, నేను మీకు తెలియజేస్తాను.",  # needs native-speaker review
    },
    "cancelled": {
        "en": "Okay, I have cancelled it. You can send a new voice message any time.",
        "ta": "சரி, அதை ரத்து செய்துவிட்டேன். எப்போது வேண்டுமானாலும் புதிய குரல் செய்தி அனுப்பலாம்.",  # needs native-speaker review
        "hi": "ठीक है, मैंने इसे रद्द कर दिया है। आप कभी भी नया वॉइस मैसेज भेज सकते हैं।",  # needs native-speaker review
        "te": "సరే, దాన్ని రద్దు చేశాను. మీరు ఎప్పుడైనా కొత్త వాయిస్ మెసేజ్ పంపవచ్చు.",  # needs native-speaker review
    },
    "booked": {
        "en": "Good news. Your family has booked your car. Please be ready on time.",
        "ta": "நல்ல செய்தி. உங்கள் குடும்பத்தினர் உங்களுக்காக காரை பதிவு செய்துவிட்டார்கள். நேரத்திற்கு தயாராக இருங்கள்.",  # needs native-speaker review
        "hi": "अच्छी खबर। आपके परिवार ने आपकी गाड़ी बुक कर दी है। कृपया समय पर तैयार रहिए।",  # needs native-speaker review
        "te": "మంచి వార్త. మీ కుటుంబ సభ్యులు మీ కారు బుక్ చేశారు. దయచేసి సమయానికి సిద్ధంగా ఉండండి.",  # needs native-speaker review
    },
    "declined": {
        "en": "Your family could not book this car right now. They will talk to you soon. Please don't worry.",
        "ta": "உங்கள் குடும்பத்தினரால் இப்போது இந்த காரை பதிவு செய்ய முடியவில்லை. அவர்கள் விரைவில் உங்களிடம் பேசுவார்கள். கவலைப்பட வேண்டாம்.",  # needs native-speaker review
        "hi": "आपका परिवार अभी यह गाड़ी बुक नहीं कर पाया। वे जल्दी ही आपसे बात करेंगे। कृपया चिंता मत कीजिए।",  # needs native-speaker review
        "te": "మీ కుటుంబ సభ్యులు ఇప్పుడు ఈ కారు బుక్ చేయలేకపోయారు. వారు త్వరలో మీతో మాట్లాడతారు. దయచేసి కంగారు పడకండి.",  # needs native-speaker review
    },
    "non_ride": {
        "en": "I am an assistant and can only help with booking a car right now. I have told your family, and they will help you.",
        "ta": "நான் ஒரு உதவியாளர், இப்போது கார் பதிவு செய்ய மட்டுமே உதவ முடியும். உங்கள் குடும்பத்தினரிடம் சொல்லிவிட்டேன், அவர்கள் உங்களுக்கு உதவுவார்கள்.",  # needs native-speaker review
        "hi": "मैं एक सहायक हूँ और अभी सिर्फ़ गाड़ी बुक करवाने में मदद कर सकता हूँ। मैंने आपके परिवार को बता दिया है, वे आपकी मदद करेंगे।",  # needs native-speaker review
        "te": "నేను ఒక సహాయకుడిని, ప్రస్తుతం కారు బుక్ చేయడంలో మాత్రమే సహాయం చేయగలను. మీ కుటుంబ సభ్యులకు చెప్పాను, వారు మీకు సహాయం చేస్తారు.",  # needs native-speaker review
    },
    "error_family_will_help": {
        "en": "Sorry, something went wrong. I have told your family, and they will help you.",
        "ta": "மன்னிக்கவும், ஏதோ தவறு நடந்துவிட்டது. உங்கள் குடும்பத்தினரிடம் சொல்லிவிட்டேன், அவர்கள் உங்களுக்கு உதவுவார்கள்.",  # needs native-speaker review
        "hi": "माफ़ कीजिए, कुछ गड़बड़ हो गई। मैंने आपके परिवार को बता दिया है, वे आपकी मदद करेंगे।",  # needs native-speaker review
        "te": "క్షమించండి, ఏదో పొరపాటు జరిగింది. మీ కుటుంబ సభ్యులకు చెప్పాను, వారు మీకు సహాయం చేస్తారు.",  # needs native-speaker review
    },
    "unclear_family_will_help": {
        "en": "I could not understand, so I have told your family. They will help you.",
        "ta": "எனக்கு புரியவில்லை, அதனால் உங்கள் குடும்பத்தினரிடம் சொல்லிவிட்டேன். அவர்கள் உங்களுக்கு உதவுவார்கள்.",  # needs native-speaker review
        "hi": "मैं समझ नहीं पाया, इसलिए मैंने आपके परिवार को बता दिया है। वे आपकी मदद करेंगे।",  # needs native-speaker review
        "te": "నాకు అర్థం కాలేదు, అందుకే మీ కుటుంబ సభ్యులకు చెప్పాను. వారు మీకు సహాయం చేస్తారు.",  # needs native-speaker review
    },
    "send_voice_please": {
        "en": "Please send me a voice message.",
        "ta": "தயவுசெய்து எனக்கு ஒரு குரல் செய்தி அனுப்புங்கள்.",  # needs native-speaker review
        "hi": "कृपया मुझे एक वॉइस मैसेज भेजिए।",  # needs native-speaker review
        "te": "దయచేసి నాకు ఒక వాయిస్ మెసేజ్ పంపండి.",  # needs native-speaker review
    },
}


def get(key, lang, **values):
    """Return the phrase for key in lang (English if lang is unknown)."""
    phrases = STRINGS[key]
    text = phrases.get(lang) or phrases["en"]
    return text.format(**values) if values else text
