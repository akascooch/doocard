const { PrismaClient } = require('@prisma/client');
const jalaali = require('jalaali-js');
const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;
function jalaliRange(jstr) {
  const [jy,jm,jd]=jstr.split('/').map(Number);
  const g=jalaali.toGregorian(jy,jm,jd);
  const start=new Date(Date.UTC(g.gy,g.gm-1,g.gd,0,0,0,0)-TEHRAN_OFFSET_MS);
  const end=new Date(Date.UTC(g.gy,g.gm-1,g.gd,23,59,59,999)-TEHRAN_OFFSET_MS);
  return {start,end};
}
(async()=>{
  const prisma=new PrismaClient();
  try{
    for (const day of ['1405/04/20','1405/04/21']) {
      const {start,end}=jalaliRange(day);
      const apts=await prisma.appointment.findMany({
        where:{deletedAt:null,tipAmount:{gt:0n},paidAt:{gte:start,lte:end},status:{in:['SETTLED','PAID','COMPLETED']}},
        include:{tipAllocations:{include:{employee:{include:{user:{select:{role:true,name:true}}}}}}}
      });
      const team=apts.filter(a=>a.tipRecipientType==='TEAM');
      const ind=apts.filter(a=>a.tipRecipientType==='INDIVIDUAL');
      const teamSum=team.reduce((s,a)=>s+(a.tipAmount||0n),0n);
      const indSum=ind.reduce((s,a)=>s+(a.tipAmount||0n),0n);
      let nonServiceTeam=0n, serviceTeam=0n, reconDiff=0n;
      const byEmp={};
      for (const a of team) {
        const allocSum=a.tipAllocations.reduce((s,x)=>s+x.amountRial,0n);
        reconDiff += (a.tipAmount||0n)-allocSum;
        for (const x of a.tipAllocations) {
          const role=x.employee?.user?.role;
          if (role==='SERVICE') { serviceTeam+=x.amountRial; byEmp[x.employeeId]=(byEmp[x.employeeId]||0n)+x.amountRial; }
          else nonServiceTeam+=x.amountRial;
        }
      }
      const indByEmp={};
      for (const a of ind) for (const x of a.tipAllocations) indByEmp[x.employeeId]=(indByEmp[x.employeeId]||0n)+x.amountRial;
      console.log(JSON.stringify({
        day,
        totalSources: apts.length,
        teamCount: team.length,
        teamToman: (teamSum/10n).toString(),
        individualCount: ind.length,
        individualToman: (indSum/10n).toString(),
        serviceTeamToman: (serviceTeam/10n).toString(),
        nonServiceTeamToman: (nonServiceTeam/10n).toString(),
        teamReconDiffToman: (reconDiff/10n).toString(),
        teamByEmpToman: Object.fromEntries(Object.entries(byEmp).map(([k,v])=>[k,(v/10n).toString()])),
        indByEmpToman: Object.fromEntries(Object.entries(indByEmp).map(([k,v])=>[k,(v/10n).toString()])),
      }, null, 2));
    }
  } finally { await prisma.$disconnect(); }
})().catch(e=>{console.error(String(e&&e.message||e)); process.exit(1);});
