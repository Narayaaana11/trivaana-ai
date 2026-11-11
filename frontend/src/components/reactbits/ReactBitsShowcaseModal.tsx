import React, { useState } from 'react';
import {
  BlurText,
  GradientText,
  RotatingText,
  SplitText,
  DecryptedText,
  TextType,
  TrueFocus,
  CircularText,
  TextLoop,
  SplitFlapText,
  ScrambledText,
  Shuffle,
  FuzzyText,
  ScrollReveal,
  CountUp,
  Counter,
  ElasticSlider,
  SpotlightCard,
  BorderGlow,
  TiltedCard,
  GlassIcons,
  PillNav,
  Dock,
  CardSwap,
  HoloCard,
  GooeyNav,
  StarBorder,
  GlareHover,
  ClickSpark,
  ElectricBorder,
  SpecularButton,
  RippleButton,
  LogoLoop,
  VoicePill,
  StatusMark,
  SquishSwitch,
  SloshGauge,
  RubberSegment,
  SpringCheck,
  LatticeLoader,
  ThoughtLine,
  HoldButton,
  AuroraBackground,
  WavesBackground,
  RadarBackground,
  GridScanBackground,
  ThreadsBackground,
  RipplesBackground,
} from '@/components/reactbits';
import { X, Bot, PhoneCall, Sparkles, Zap, ShieldCheck, Layers } from 'lucide-react';

interface ReactBitsShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CategoryKey = 'all' | 'text' | 'animations' | 'components' | 'micro' | 'backgrounds';

export const ReactBitsShowcaseModal: React.FC<ReactBitsShowcaseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [category, setCategory] = useState<CategoryKey>('all');
  const [sliderVal, setSliderVal] = useState(65);
  const [switchVal, setSwitchVal] = useState(true);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [checkVal, setCheckVal] = useState(true);
  const [segVal, setSegVal] = useState('te');
  const [counterVal, setCounterVal] = useState(124);
  const [holdDone, setHoldDone] = useState(false);

  if (!isOpen) return null;

  const show = (cat: CategoryKey) => category === 'all' || category === cat;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#f6f6f8] rounded-3xl max-w-5xl w-full max-h-[88vh] border border-[#e4e4e9] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white px-6 py-4 border-b border-[#e4e4e9] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#ff5500]" />
              <h2 className="font-display text-lg font-extrabold text-[#0f0f14]">
                Trivaana × ReactBits UI Studio
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]">
                58 Components · 5 Categories
              </span>
            </div>
            <p className="text-xs text-[#6e6e7e]">
              Interactive live gallery of every integrated ReactBits text animation, effect, surface, micro-interaction, and background.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close UI Studio"
            className="p-2 rounded-xl bg-[#f6f6f8] hover:bg-[#ebebf0] border border-[#e4e4e9] text-[#0f0f14] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 bg-white border-b border-[#e4e4e9] overflow-x-auto">
          <PillNav
            layoutGroupId="rbGalleryCat"
            activeId={category}
            onChange={(id) => setCategory(id as CategoryKey)}
            items={[
              { id: 'all', label: 'All Categories' },
              { id: 'text', label: 'Text Animations' },
              { id: 'animations', label: 'Animations' },
              { id: 'components', label: 'Components' },
              { id: 'micro', label: 'Micro-Interactions' },
              { id: 'backgrounds', label: 'Backgrounds' },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {show('text') && (
            <section className="space-y-3">
              <h3 className="font-display text-sm font-extrabold text-[#0f0f14]">Text Animations</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9] space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-[#8a8a98]">BlurText + GradientText</div>
                  <div className="font-display text-base font-extrabold">
                    <BlurText text="Instant" /> <GradientText>Voice AI</GradientText>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9] space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-[#8a8a98]">RotatingText &amp; TextLoop</div>
                  <div className="font-bold text-sm">
                    Dial in <RotatingText texts={['Telugu', 'Hindi', 'Tamil']} className="text-[#ff5500]" /> ·{' '}
                    <TextLoop items={['<30s SLA', '24×7 AI']} className="text-emerald-700" />
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9] space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-[#8a8a98]">SplitFlapText &amp; DecryptedText</div>
                  <div className="flex items-center justify-between gap-2">
                    <SplitFlapText text="LIVE 24X7" />
                    <DecryptedText text="trv_key_live" className="font-mono-code font-bold text-[#ff5500]" />
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9] space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-[#8a8a98]">TextType &amp; TrueFocus</div>
                  <TextType strings={['Generating Telugu prompt...']} className="font-semibold text-[#0f0f14] block" />
                  <TrueFocus items={['Instant', 'Bulk', 'Inbound']} />
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9] space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-[#8a8a98]">ScrambledText · Shuffle · Fuzzy</div>
                  <div className="flex flex-wrap items-center gap-3 font-bold">
                    <ScrambledText text="HOVER TO DECODE" className="text-[#0f0f14]" />
                    <Shuffle text="TRAI SAFE" className="text-emerald-700" />
                    <FuzzyText className="text-[#ff5500]">LIVE</FuzzyText>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#8a8a98]">CircularText &amp; SplitText</div>
                    <ScrollReveal text="Smooth scroll words." className="font-bold text-sm mt-1 block" />
                    <SplitText text="Word reveal" className="text-[11px] text-[#525260]" />
                  </div>
                  <CircularText text="TRIVAANA · VOICE · AI · " size={72} className="text-[#ff5500]" />
                </div>
              </div>
            </section>
          )}

          {show('animations') && (
            <section className="space-y-3">
              <h3 className="font-display text-sm font-extrabold text-[#0f0f14]">Animations</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9] flex items-center justify-between gap-2">
                  <StarBorder>
                    <button type="button" className="px-4 py-2 rounded-full bg-[#ff5500] text-white font-bold text-xs">
                      StarBorder
                    </button>
                  </StarBorder>
                  <ClickSpark>
                    <SpecularButton className="px-4 py-2 rounded-xl bg-[#0f0f14] text-white font-bold text-xs">
                      ClickSpark + Specular
                    </SpecularButton>
                  </ClickSpark>
                </div>
                <ElectricBorder>
                  <div className="p-4 flex items-center justify-between">
                    <span className="font-bold text-[#0f0f14]">ElectricBorder Card</span>
                    <RippleButton className="px-3 py-1.5 rounded-lg bg-[#fff7ed] text-[#c2410c] font-bold">
                      Ripple
                    </RippleButton>
                  </div>
                </ElectricBorder>
                <GlareHover className="rounded-2xl">
                  <div className="p-4 rounded-2xl bg-[#121019] text-white border border-white/10">
                    <div className="font-bold">GlareHover + LogoLoop</div>
                    <LogoLoop items={[{ name: 'Sarvam' }, { name: 'ElevenLabs' }, { name: 'Exotel' }]} className="mt-2" />
                  </div>
                </GlareHover>
              </div>
            </section>
          )}

          {show('components') && (
            <section className="space-y-3">
              <h3 className="font-display text-sm font-extrabold text-[#0f0f14]">Components</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <TiltedCard>
                  <BorderGlow>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <GlassIcons icon={Bot} accent="orange" />
                        <div className="flex items-center gap-2">
                          <Counter value={counterVal} className="font-display text-lg font-extrabold" />
                          <button
                            type="button"
                            onClick={() => setCounterVal((v) => v + 1)}
                            className="px-2 py-0.5 rounded bg-[#f6f6f8] border border-[#e4e4e9] font-bold cursor-pointer"
                          >
                            +1
                          </button>
                        </div>
                      </div>
                      <ElasticSlider min={0} max={100} value={sliderVal} onChange={setSliderVal} />
                    </div>
                  </BorderGlow>
                </TiltedCard>

                <SpotlightCard className="!p-4">
                  <div className="text-[10px] font-bold uppercase text-[#8a8a98] mb-2">CardSwap Live Deck</div>
                  <CardSwap
                    cards={[
                      { id: 'c1', badge: 'te-IN', title: 'Venkat Rao · 3BHK Villa', meta: '142s', outcome: 'Site Visit Booked' },
                      { id: 'c2', badge: 'hi-IN', title: 'Dr. Sunita · NEET Test', meta: '98s', outcome: 'Test Link Sent' },
                    ]}
                  />
                </SpotlightCard>

                <HoloCard>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold">HoloCard + Dock + GooeyNav</span>
                    <CountUp to={58} duration={0.6} className="font-display text-lg font-extrabold text-[#ff8547]" />
                  </div>
                  <GooeyNav
                    layoutId="studioGooey"
                    activeId={segVal}
                    onChange={setSegVal}
                    items={[
                      { id: 'te', label: 'Telugu' },
                      { id: 'hi', label: 'Hindi' },
                      { id: 'en', label: 'English' },
                    ]}
                  />
                  <div className="mt-3">
                    <Dock
                      items={[
                        { label: 'Dial', icon: PhoneCall, onClick: () => {} },
                        { label: 'Zap', icon: Zap, onClick: () => {} },
                        { label: 'Guard', icon: ShieldCheck, onClick: () => {} },
                      ]}
                    />
                  </div>
                </HoloCard>
              </div>
            </section>
          )}

          {show('micro') && (
            <section className="space-y-3">
              <h3 className="font-display text-sm font-extrabold text-[#0f0f14]">Micro-Interactions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9] space-y-3">
                  <div className="flex items-center justify-between">
                    <VoicePill active={voicePlaying} label="VoicePill Wave" onClick={() => setVoicePlaying((v) => !v)} />
                    <StatusMark status="online" label="Live" />
                  </div>
                  <div className="flex items-center justify-between">
                    <SquishSwitch checked={switchVal} onChange={setSwitchVal} label="SquishSwitch" />
                    <SpringCheck checked={checkVal} onClick={() => setCheckVal((c) => !c)} label="SpringCheck" />
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9] space-y-3">
                  <SloshGauge percentage={sliderVal} label="SloshGauge Capacity" />
                  <div className="flex items-center justify-between">
                    <RubberSegment
                      layoutId="studioRubber"
                      activeId={segVal}
                      onChange={setSegVal}
                      items={[
                        { id: 'te', label: 'te-IN' },
                        { id: 'hi', label: 'hi-IN' },
                      ]}
                    />
                    <LatticeLoader />
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#e4e4e9] space-y-3">
                  <ThoughtLine
                    steps={[
                      { title: 'KB Retrieved', subtitle: '3 chunks verified', done: true },
                      { title: 'TTS Streaming', subtitle: 'Sarvam Bulbul v3', done: true },
                    ]}
                  />
                  <HoldButton
                    label={holdDone ? 'Confirmed!' : 'HoldButton (0.9s)'}
                    onConfirm={() => setHoldDone(true)}
                    className="bg-red-50 border-red-200 text-red-700 w-full"
                  />
                </div>
              </div>
            </section>
          )}

          {show('backgrounds') && (
            <section className="space-y-3">
              <h3 className="font-display text-sm font-extrabold text-[#0f0f14]">Backgrounds</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-bold">
                <AuroraBackground className="p-5 rounded-2xl bg-[#121019] text-white border border-white/10">
                  <Layers className="w-4 h-4 text-[#ff8547] mb-1" /> AuroraBackground
                </AuroraBackground>
                <WavesBackground className="p-5 rounded-2xl bg-white border border-[#e4e4e9] text-[#0f0f14]">
                  WavesBackground
                </WavesBackground>
                <RadarBackground className="p-5 rounded-2xl bg-white border border-[#e4e4e9] text-[#0f0f14]">
                  RadarBackground
                </RadarBackground>
                <div className="grid grid-cols-2 gap-2">
                  <GridScanBackground className="p-3 rounded-xl bg-white border border-[#e4e4e9] text-[10px]">
                    GridScan
                  </GridScanBackground>
                  <ThreadsBackground className="p-3 rounded-xl bg-white border border-[#e4e4e9] text-[10px]">
                    Threads
                  </ThreadsBackground>
                  <RipplesBackground className="p-3 rounded-xl bg-white border border-[#e4e4e9] text-[10px] col-span-2">
                    RipplesBackground
                  </RipplesBackground>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

