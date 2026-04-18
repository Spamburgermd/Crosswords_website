import Nav from './components/Nav'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import GameModes from './components/GameModes'
import WhyDifferent from './components/WhyDifferent'
import DailyTeaser from './components/DailyTeaser'
import CTA from './components/CTA'
import Footer from './components/Footer'

function Divider() {
  return (
    <div className="divider">
      <div className="divider-line"></div>
    </div>
  )
}

export default function App() {
  return (
    <>
      <Nav />
      <Hero />
      <Divider />
      <HowItWorks />
      <Divider />
      <GameModes />
      <Divider />
      <WhyDifferent />
      <DailyTeaser />
      <Divider />
      <CTA />
      <Footer />
    </>
  )
}
