import {notFound} from 'next/navigation';
import ApplicationIntelligence from '../../ApplicationIntelligence';
import {STEPS} from '../../lib/application-intelligence.mjs';
export function generateStaticParams(){return STEPS.map(step=>({step}))}
export default async function StepPage({params}){const {step}=await params;if(!STEPS.includes(step))notFound();return <ApplicationIntelligence step={step}/>}