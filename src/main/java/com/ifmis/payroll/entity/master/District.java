package com.ifmis.payroll.entity.master;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "district")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class District {

    @Id
    @Column(name = "district_key", nullable = false, updatable = false)
    private String districtKey;

    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "province_key", nullable = false)
    private Province province;
}