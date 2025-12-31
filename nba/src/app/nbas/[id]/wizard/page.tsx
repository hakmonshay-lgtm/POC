import { Wizard } from "@/components/Wizard";

export default async function NbaWizardPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <Wizard initialNbaId={id} />;
}

