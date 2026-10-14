// TRANG BÌA CHÍNH + BÌA PHỤ — SỬA CÁC BIẾN DƯỚI ĐÂY theo đồ án của bạn.
// Trình bày theo mẫu thống nhất của Trường (bìa không đánh số trang).

#let HO-TEN = [NGUYỄN VĂN A]
#let TEN-DE-TAI = [XÂY DỰNG WEBSITE QUẢN LÝ ABC CHO ĐƠN VỊ XYZ]
#let NGANH = [Kỹ thuật phần mềm]
#let MA-SO = [7480103]
#let GVHD = [ThS. Nguyễn Văn B]
#let NAM = [2026]

// ===================== BÌA CHÍNH =====================
#align(center)[
  #set par(leading: 0.85em, justify: false)
  #text(size: 13pt, weight: "bold")[BỘ GIÁO DỤC VÀ ĐÀO TẠO #h(1cm) BỘ NÔNG NGHIỆP VÀ MÔI TRƯỜNG]

  #text(size: 13pt, weight: "bold")[TRƯỜNG ĐẠI HỌC THỦY LỢI]

  #text(size: 14pt)[---------\*\*\*--------]

  #v(10pt)
  #image("../assets/images/logo-tlu.png", width: 4.2cm)
  #v(14pt)

  #text(size: 14pt, weight: "bold")[#HO-TEN]

  #v(40pt)
  #text(size: 16pt, weight: "bold")[ĐỀ TÀI: #TEN-DE-TAI]

  #v(46pt)
  #text(size: 14pt, weight: "bold")[ĐỒ ÁN TỐT NGHIỆP]

  #v(1fr)
  #text(size: 14pt, weight: "bold")[HÀ NỘI, NĂM #NAM]
]

#pagebreak()

// ===================== BÌA PHỤ =====================
#align(center)[
  #set par(leading: 0.85em, justify: false)
  #text(size: 13pt, weight: "bold")[BỘ GIÁO DỤC VÀ ĐÀO TẠO #h(1cm) BỘ NÔNG NGHIỆP VÀ MÔI TRƯỜNG]

  #text(size: 13pt, weight: "bold")[TRƯỜNG ĐẠI HỌC THỦY LỢI]

  #text(size: 14pt)[---------\*\*\*--------]

  #v(30pt)
  #text(size: 14pt, weight: "bold")[#HO-TEN]

  #v(34pt)
  #text(size: 14pt, weight: "bold")[ĐỀ TÀI: #TEN-DE-TAI]

  #v(34pt)
  #text(size: 14pt)[Ngành: #NGANH]

  #text(size: 14pt)[Mã số: #MA-SO]

  #v(24pt)
  #text(size: 14pt)[GIẢNG VIÊN HƯỚNG DẪN: #GVHD]

  #v(1fr)
  #text(size: 14pt, weight: "bold")[HÀ NỘI, NĂM #NAM]
]
