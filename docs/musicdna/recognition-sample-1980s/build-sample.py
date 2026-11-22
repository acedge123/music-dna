import re
import os,json,time,requests,csv,re,sys
UA={"User-Agent":"MusicDNA-recognition-sample/0.1 (contact@musicdna.fm)"}
TOK=re.sub(r"[^A-Za-z0-9-]","",os.environ["LISTENBRAINZ_TOKEN"])
cat=json.load(open('./catalog_artists.json'))
extra={"Prince":"pop","U2":"classic_rock","Bon Jovi":"classic_rock","Def Leppard":"metal","Guns N' Roses":"metal","Bruce Springsteen":"classic_rock","Duran Duran":"pop","The Police":"post_punk_new_wave","R.E.M.":"post_punk_new_wave","INXS":"pop","Run-DMC":"hip_hop","LL Cool J":"hip_hop","Beastie Boys":"hip_hop","Phil Collins":"pop","Lionel Richie":"r_and_b","Van Halen":"classic_rock","Mötley Crüe":"metal","Bryan Adams":"classic_rock","Huey Lewis & the News":"classic_rock","Reba McEntire":"country","Alabama":"country","Def Leppard":"metal","Wham!":"pop","Culture Club":"pop","The Bangles":"pop","Simple Minds":"post_punk_new_wave","Talk Talk":"post_punk_new_wave","Hüsker Dü":"punk_noise_edge","N.W.A":"hip_hop","Salt-N-Pepa":"hip_hop","Pat Benatar":"classic_rock","Heart":"classic_rock","Billy Idol":"post_punk_new_wave","Erasure":"electronic","Soft Cell":"electronic","Frankie Goes to Hollywood":"pop","Peter Gabriel":"artrock_experimental","Dire Straits":"classic_rock","Toto":"yacht_rock","Rick Astley":"pop","Whitesnake":"metal","Bananarama":"pop","The B-52's":"post_punk_new_wave","Midnight Oil":"classic_rock","Roxette":"pop","Sade":"r_and_b","Paula Abdul":"pop","Bobby Brown":"r_and_b"}
artists={a["artist"]:(a["lane"],"catalog") for a in cat}
for k,v in extra.items(): artists.setdefault(k,(v,"proposed"))
def get(u,p):
  for i in range(10):
    r=requests.get(u,params=p,headers=UA,timeout=30); time.sleep(1.5)
    if r.status_code==200: return r.json()
    time.sleep(6)
  return None
norm=lambda s:re.sub(r'[^a-z0-9]','',s.lower())
rows=[];log=[]
for name,(lane,src) in artists.items():
  s=get("https://musicbrainz.org/ws/2/artist",{"query":f'artist:"{name}"',"fmt":"json","limit":3})
  if not s or not s.get("artists"): log.append(f"no artist {name}");continue
  a=s["artists"][0]; mbid=a["id"]
  if norm(a["name"])!=norm(name): log.append(f"artist mismatch {name}->{a['name']}");continue
  rg=get("https://musicbrainz.org/ws/2/release-group",{"artist":mbid,"fmt":"json","limit":100})
  years={}
  for g in (rg or {}).get("release-groups",[]):
    d=g.get("first-release-date","")[:4]
    if d.isdigit(): years.setdefault(norm(g["title"]),int(d)); years[norm(g["title"])]=min(years[norm(g["title"])],int(d))
  r=requests.get(f"https://api.listenbrainz.org/1/popularity/top-recordings-for-artist/{mbid}",headers={**UA,"Authorization":"Token "+TOK},timeout=30)
  recs=r.json() if r.status_code==200 else []
  seen=set();kept=0
  for x in recs[:60]:
    y=years.get(norm(x.get("release_name","")))
    t=x["recording_name"]; key=norm(re.sub(r'\s*[\(\[].*','',t))
    if y is None or not(1980<=y<=1989) or key in seen: continue
    seen.add(key); kept+=1
    rows.append({"title":t,"artist":x["artist_name"],"year":y,"release":x["release_name"],"lane_hint":lane,"lane_hint_source":src,"listen_count":x.get("total_listen_count",""),"recording_mbid":x["recording_mbid"],"artist_mbid":mbid})
    if kept>=12: break
  print(name,kept,flush=True)
rows.sort(key=lambda r:(r["year"],r["artist"]))
with open('./sample-1980s.csv','w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0].keys()));w.writeheader();w.writerows(rows)
open('./log.txt','w').write("\n".join(log))
print("TOTAL",len(rows))
