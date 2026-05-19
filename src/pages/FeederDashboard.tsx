import { HeaderSection } from '../sections/HeaderSection'
import { WidthControlSection } from '../sections/WidthControlSection'
import { RollerStatusSection } from '../sections/RollerStatusSection'
import { DiagnosticsSection } from '../sections/DiagnosticsSection'
import { SettingsSection } from '../sections/SettingsSection'
export default function FeederDashboard() {
  return (
    <div className="space-y-6 pb-8">
      <HeaderSection />

      <WidthControlSection />

      <RollerStatusSection />

      <DiagnosticsSection />

      <SettingsSection />
    </div>
  )
}
