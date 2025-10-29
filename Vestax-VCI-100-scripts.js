VestaxVCI100 = new function() {
    this.group = "[Master]";
    this.loopHotcueDeck = null;
    this.shiftMode = false;
    this.hotcueMode = false;
    this.rollMode = false;
    this.stemMode = false;
    this.lastTempo1 = 0;
    this.lastTempo2 = 0;
    this.jogPlaylistScrollMode = false;
    this.Controls = [];
    this.Buttons = [];

    engine.connectControl("[Channel1]", "track_loaded", () => {
        engine.setValue("[Channel1]", "rate", 0);
    });

    engine.connectControl("[Channel2]", "track_loaded", () => {
        engine.setValue("[Channel2]", "rate", 0);
    });
}

VestaxVCI100.Deck = function (deckNumber, group) {
    this.deckNumber = deckNumber;
    this.group = group;
    this.vinylMode = true;
    this.scratching = false;
    this.loop = false;
    this.hotcue = false;
    this.Buttons = [];
}

VestaxVCI100.Deck.prototype.jogMove = function(jogValue) {
    jogValue = jogValue * 3;
    engine.setValue(this.group,"jog", jogValue);
}

VestaxVCI100.Deck.prototype.scratchMove = function(jogValue) {
    engine.scratchTick(this.deckNumber, jogValue);
}

VestaxVCI100.Decks = {"Left":new VestaxVCI100.Deck(1,"[Channel1]"), "Right":new VestaxVCI100.Deck(2,"[Channel2]")};
VestaxVCI100.GroupToDeck = {"[Channel1]":"Left", "[Channel2]":"Right"};

VestaxVCI100.GetDeck = function(group) {
    try {
        return VestaxVCI100.Decks[VestaxVCI100.GroupToDeck[group]];
    } catch(ex) {
        return null;
    }
}

VestaxVCI100.init = function (id) {
    midi.sendShortMsg(0xB0,0x62,0x7F);
    midi.sendShortMsg(0xB0,0x63,0x7F);
    midi.sendShortMsg(0xB0,0x64,0x7F);

    midi.sendShortMsg(0x90,0x65,0x7F);
    midi.sendShortMsg(0x90,0x66,0x7F);
    midi.sendShortMsg(0x90,0x67,0x7F);
    midi.sendShortMsg(0x90,0x68,0x7F);

    midi.sendShortMsg(0xB0,0x64,0x00);
    midi.sendShortMsg(0x90,0x67,0x00);
    midi.sendShortMsg(0x80,0x68,0x00);

   // turn off all LEDs
    for (var i = 30; i <= 81; i++) {
        midi.sendShortMsg(0x90, i, 0x00);
    }

    engine.setValue("[EffectRack1_EffectUnit1]", "mix", 1.0);
    engine.setValue("[EffectRack1_EffectUnit2]", "mix", 1.0);

    midi.sendShortMsg(0x90, 0x48, 0x00); // turn off deck 1 headphone listen LED
    midi.sendShortMsg(0x90, 0x49, 0x00); // turn off deck 2 headphone listen LED
}

//Mapping functions
VestaxVCI100.vinyl_mode = function (channel, control, value, status, group) {
    var deck = VestaxVCI100.GetDeck(group);
    midi.sendShortMsg(0xB0, control, 0x00);
}

VestaxVCI100.jog_touch = function (channel, control, value, status, group) {
    var deck = VestaxVCI100.GetDeck(group);
    if(value) {
        engine.scratchEnable(deck.deckNumber, 128*3, 45, 1.0/8, (1.0/8)/32);
    } else {
        engine.scratchDisable(deck.deckNumber);
    }
}

VestaxVCI100.jog_wheel = function (channel, control, value, status, group) {
    // 41 > 7F: CW Slow > Fast ???
    // 3F > 0 : CCW Slow > Fast ???
    var jogValue = value - 0x40; // -64 to +63, - = CCW, + = CW

    if (this.shiftMode) {
       VestaxVCI100.GetDeck(group).jogMove(jogValue * 15);
    } else {
       VestaxVCI100.GetDeck(group).jogMove(jogValue);
    }
}

VestaxVCI100.jog_wheel_scratch = function (channel, control, value, status, group) {
    // 41 > 7F: CW Slow > Fast ???
    // 3F > 0 : CCW Slow > Fast ???
    var jogValue = value - 0x40; // -64 to +63, - = CCW, + = CW
    if (this.shiftMode) {
       VestaxVCI100.GetDeck(group).scratchMove(jogValue * 15);
    } else {
       VestaxVCI100.GetDeck(group).scratchMove(jogValue);
    }
}

VestaxVCI100.libraryUp = function (channel, control, value, status, group) {
    if (value === 0x00) {
        return;
    }

    if (this.shiftMode) {
        engine.setValue("[Playlist]", "SelectPlaylist", -1);
    } else {
        engine.setValue("[Playlist]", "SelectPrevTrack", 1);
    }
}

VestaxVCI100.libraryDown = function (channel, control, value, status, group) {
    if (value === 0x00) {
        return;
    }

    if (this.shiftMode) {
        engine.setValue("[Playlist]", "SelectPlaylist", 1);
    } else {
        engine.setValue("[Playlist]", "SelectNextTrack", 1);
    }
}

VestaxVCI100.loadLeft = function (channel, control, value, status, group) {
    if (value === 0x00) {
        return;
    }

    if (this.shiftMode) {
        engine.setValue("[Library]", "MoveFocusBackward", 1);
    } else {
        engine.setValue("[Channel1]", "LoadSelectedTrack", 1);
    }
}

VestaxVCI100.loadRight = function (channel, control, value, status, group) {
    if (value === 0x00) {
        return;
    }

    if (this.shiftMode) {
        engine.setValue("[Library]", "GoToItem", 1);
    } else {
        engine.setValue("[Channel2]", "LoadSelectedTrack", 1);
    }
}

VestaxVCI100.shiftToggle = function (channel, control, value, status, group) {
    this.shiftMode = !this.shiftMode;
    // console.log("toggled shift to: ", this.shiftMode);
}

VestaxVCI100.hotcueButton = function (channel, control, value, status, group) {
    var deck = VestaxVCI100.GetDeck(group);
    this.hotcueMode = !this.hotcueMode;
    console.log("toggled hotcue mode to: ", this.hotcueMode);

    if (this.hotcueMode) {
        // turn on all bottom row lights
        for (var i = 0x32; i <= 0x39; i++) {
           midi.sendShortMsg(0x90, i, 0x7F);
        }
    } else {
        // turn off all bottom row lights
        for (var i = 0x32; i <= 0x39; i++) {
           midi.sendShortMsg(0x90, i, 0x00);
        }
    }
}

VestaxVCI100.rollToggle = function (channel, control, value, status, group) {
    this.rollMode = !this.rollMode;

    if (this.rollMode) {
        // turn on all bottom row lights
        for (var i = 0x32; i <= 0x39; i++) {
           midi.sendShortMsg(0x90, i, 0x7F);
        }
    } else {
        // turn off all bottom row lights
        for (var i = 0x32; i <= 0x39; i++) {
           midi.sendShortMsg(0x90, i, 0x00);
        }
    }
}

VestaxVCI100.stemToggle = function (channel, control, value, status, group) {
    this.stemMode = !this.stemMode;

    if (this.stemMode) {
        // turn on all bottom row lights
        for (var i = 0x32; i <= 0x39; i++) {
           midi.sendShortMsg(0x90, i, 0x7F);
        }
    } else {
        // turn off all bottom row lights
        for (var i = 0x32; i <= 0x39; i++) {
           midi.sendShortMsg(0x90, i, 0x00);
        }
    }
}

VestaxVCI100.nextChain = function (channel, control, value, status, group) {
    if (value === 0x00) {
        return;
    }

    engine.setValue("[EffectRack1_EffectUnit1]", "next_chain_preset", 1);
    engine.setValue("[EffectRack1_EffectUnit2]", "next_chain_preset", 1);
    engine.setValue("[EffectRack1_EffectUnit3]", "next_chain_preset", 1);
    engine.setValue("[EffectRack1_EffectUnit4]", "next_chain_preset", 1);
}

VestaxVCI100.prevChain = function (channel, control, value, status, group) {
    if (value === 0x00) {
        return;
    }

    engine.setValue("[EffectRack1_EffectUnit1]", "prev_chain_preset", 1);
    engine.setValue("[EffectRack1_EffectUnit2]", "prev_chain_preset", 1);
    engine.setValue("[EffectRack1_EffectUnit3]", "prev_chain_preset", 1);
    engine.setValue("[EffectRack1_EffectUnit4]", "prev_chain_preset", 1);
}

VestaxVCI100.syncButton = function (channel, control, value, status, group) {
    if (value === 0x00) {
        return;
    }

    if (this.shiftMode) {
        engine.setValue(group, "sync_key", 1);
    } else {
        engine.setValue(group, "beatsync", 1);
    }
}

VestaxVCI100.loopLength = function (channel, control, value, status, group) {
    if (value === 0x00) {
        return;
    }

    if (this.shiftMode) {
        engine.setValue(group, "loop_double", 1);
    } else {
        engine.setValue(group, "loop_halve", 1);
    }
}

VestaxVCI100.playSampler = function (channel, control, value, status, group) {
    if (value === 0x00) {
        return;
    }

    if (this.shiftMode) {
        engine.setValue(group, "stop", 1);
    } else {
        engine.setValue(group, "start_play", 1);
    }
}

VestaxVCI100.samplerGainSuper = function (channel, control, value, status, group) {
    let newval = (value / 64);
    for (let i = 1; i <= 8; i++) {
        engine.setValue(`[Sampler${i}]`, "pregain", newval);
    }
}

VestaxVCI100.tempoSlider1 = function (channel, control, value, status, group) {
    let diff = this.lastTempo1 - ((value - 0x3F) / 64);
    this.lastTempo1 = ((value - 0x3F) / 64);

    if (!this.shiftMode) {
        let newrate = engine.getValue(group, "rate") + diff;
        engine.setValue(group, "rate", newrate);
    }
}

VestaxVCI100.tempoSlider2 = function (channel, control, value, status, group) {
    let diff = this.lastTempo2 - ((value - 0x3F) / 64);
    this.lastTempo2 = ((value - 0x3F) / 64);

    if (!this.shiftMode) {
        let newrate = engine.getValue(group, "rate") + diff;
        engine.setValue(group, "rate", newrate);
    }
}

VestaxVCI100.lower1 = function (channel, control, value, status, group) {
    if (this.rollMode && value !== 0x00) {
        engine.setValue(group, "beatlooproll_0.03125_activate", 1);
        return;
    } else if (this.rollMode && value === 0x00) {
        engine.setValue(group, "beatlooproll_0.03125_activate", 0);
        return;
    }

    if (value === 0x00) {
        return;
    }

    if (this.hotcueMode) {
        engine.setValue(group, "hotcue_1_activate", 1);
    } else if (this.stemMode) {
        stemgroup = group.substr(0, 9) + "_Stem1]";
        newval = engine.getValue(stemgroup, "mute");
        newval = newval === 0 ? 1 : 0;
        engine.setValue(stemgroup, "mute", newval);
    } else {
        engine.setValue(group, "play", !engine.getValue(group, "play"));
    }
}

VestaxVCI100.lower2 = function (channel, control, value, status, group) {
    if (this.rollMode && value !== 0x00) {
        engine.setValue(group, "beatlooproll_0.0625_activate", 1);
        return;
    } else if (this.rollMode && value === 0x00) {
        engine.setValue(group, "beatlooproll_0.0625_activate", 0);
        return;
    }

    if (value === 0x00) {
        return;
    }

    if (this.hotcueMode) {
        engine.setValue(group, "hotcue_2_activate", 1);
    } else if (this.stemMode) {
        stemgroup = group.substr(0, 9) + "_Stem2]";
        newval = engine.getValue(stemgroup, "mute");
        newval = newval === 0 ? 1 : 0;
        engine.setValue(stemgroup, "mute", newval);
    } else {
        engine.setValue(group, "cue_goto", 1);
    }
}

VestaxVCI100.lower3 = function (channel, control, value, status, group) {
    if (this.rollMode && value !== 0x00) {
        engine.setValue(group, "beatlooproll_0.125_activate", 1);
        return;
    } else if (this.rollMode && value === 0x00) {
        engine.setValue(group, "beatlooproll_0.125_activate", 0);
        return;
    }

    if (value === 0x00) {
        return;
    }

    if (this.hotcueMode) {
        engine.setValue(group, "hotcue_3_activate", 1);
    } else if (this.stemMode) {
        stemgroup = group.substr(0, 9) + "_Stem3]";
        newval = engine.getValue(stemgroup, "mute");
        newval = newval === 0 ? 1 : 0;
        engine.setValue(stemgroup, "mute", newval);
    } else {
        engine.setValue(group, "cue_preview", 1);
    }
}

VestaxVCI100.lower4 = function (channel, control, value, status, group) {
    if (this.rollMode && value !== 0x00) {
        engine.setValue(group, "beatlooproll_0.25_activate", 1);
        return;
    } else if (this.rollMode && value === 0x00) {
        engine.setValue(group, "beatlooproll_0.25_activate", 0);
        return;
    }

    if (value === 0x00) {
        return;
    }

    if (this.hotcueMode) {
        engine.setValue(group, "hotcue_4_activate", 1);
    } else if (this.stemMode) {
        stemgroup = group.substr(0, 9) + "_Stem4]";
        newval = engine.getValue(stemgroup, "mute");
        newval = newval === 0 ? 1 : 0;
        engine.setValue(stemgroup, "mute", newval);
    } else {
        engine.setValue(group, "cue_set", 1);
    }
}
