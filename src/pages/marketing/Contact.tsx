 import { useState } from 'react';
 import { Helmet } from 'react-helmet-async';
 import { Mail, Send, Check, Loader2 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Textarea } from '@/components/ui/textarea';
 import { MarketingLayout } from '@/components/marketing/MarketingLayout';
 import { MARKETING_CONFIG } from '@/config/marketing';
 
 export default function Contact() {
   const { contact } = MARKETING_CONFIG;
   const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
   const [formData, setFormData] = useState({
     name: '',
     email: '',
     message: '',
   });
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     setStatus('loading');
     
     // Simulate sending (in production, this would send to an email service)
     await new Promise(resolve => setTimeout(resolve, 1000));
     
     setStatus('success');
     setFormData({ name: '', email: '', message: '' });
   };
 
   return (
     <>
       <Helmet>
            <title>{contact.title} | DRAPE</title>
            <meta name="description" content="Kontakta oss för frågor om DRAPE." />
       </Helmet>
       
       <MarketingLayout>
         <div className="max-w-xl mx-auto px-4 py-16 md:py-24">
           <div className="text-center mb-12">
             <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
               <Mail className="w-7 h-7 text-primary" />
             </div>
             <h1 className="text-3xl md:text-4xl font-bold mb-3">{contact.title}</h1>
             <p className="text-muted-foreground">{contact.subtitle}</p>
           </div>
           
           {/* Email link */}
           <div className="text-center mb-10">
             <a 
               href={`mailto:${contact.email}`}
               className="text-primary hover:underline font-medium"
             >
               {contact.email}
             </a>
           </div>
           
           {/* Contact form */}
           {status === 'success' ? (
             <div className="flex items-center justify-center gap-3 p-6 bg-success/10 text-success rounded-xl animate-fade-in">
               <Check className="w-5 h-5" />
               <span className="font-medium">{contact.form.successMessage}</span>
             </div>
           ) : (
             <form onSubmit={handleSubmit} className="space-y-5">
               <Input
                 type="text"
                 placeholder={contact.form.namePlaceholder}
                 value={formData.name}
                 onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                 className="h-12"
                 required
               />
               
               <Input
                 type="email"
                 placeholder={contact.form.emailPlaceholder}
                 value={formData.email}
                 onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                 className="h-12"
                 required
               />
               
               <Textarea
                 placeholder={contact.form.messagePlaceholder}
                 value={formData.message}
                 onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                 rows={5}
                 required
               />
               
               <Button
                 type="submit"
                 className="w-full h-12 font-semibold"
                 disabled={status === 'loading'}
               >
                 {status === 'loading' ? (
                   <Loader2 className="w-5 h-5 animate-spin" />
                 ) : (
                   <>
                     <Send className="w-4 h-4 mr-2" />
                     {contact.form.button}
                   </>
                 )}
               </Button>
             </form>
           )}
         </div>
       </MarketingLayout>
     </>
   );
 }